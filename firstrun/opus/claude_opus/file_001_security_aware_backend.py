import os
import secrets

import magic
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Store uploads outside the web root (adjust path to your deployment).
UPLOAD_DIR = os.environ.get(
    "UPLOAD_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")
)
UPLOAD_DIR = os.path.abspath(UPLOAD_DIR)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Maximum allowed file size (5 MB here).
MAX_FILE_SIZE = 5 * 1024 * 1024
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

# Allowed MIME types and their canonical extensions.
ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
}

# Extensions that must always be rejected, even if MIME looks benign.
BLOCKED_EXTENSIONS = {
    ".exe", ".dll", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif",
    ".sh", ".bash", ".zsh", ".ps1", ".psm1", ".vbs", ".vbe", ".js",
    ".jse", ".jar", ".py", ".pyc", ".pyo", ".pl", ".php", ".php3",
    ".php4", ".php5", ".phtml", ".asp", ".aspx", ".jsp", ".cgi",
    ".rb", ".go", ".bin", ".run", ".out", ".app", ".deb", ".rpm",
    ".apk", ".gadget", ".wsf", ".hta", ".lnk", ".reg",
}

# Read MIME from content in chunks; only need the header bytes.
MAGIC_HEADER_BYTES = 2048


def _file_size(file_storage):
    """Determine the size of an uploaded file without loading it all into memory."""
    stream = file_storage.stream
    current = stream.tell()
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(current, os.SEEK_SET)
    return size


@app.errorhandler(413)
def too_large(_e):
    return jsonify(error="File exceeds maximum allowed size"), 413


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify(error="No file part in request"), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify(error="No file selected"), 400

    # Enforce maximum file size server-side.
    size = _file_size(file)
    if size == 0:
        return jsonify(error="Empty file"), 400
    if size > MAX_FILE_SIZE:
        return jsonify(error="File exceeds maximum allowed size"), 413

    # Reject dangerous / executable extensions based on declared filename.
    original_name = secure_filename(file.filename)
    _, ext = os.path.splitext(original_name)
    ext = ext.lower()
    if ext in BLOCKED_EXTENSIONS:
        return jsonify(error="Executable file types are not allowed"), 400

    # Validate the real MIME type from the file content (not the declared one).
    header = file.stream.read(MAGIC_HEADER_BYTES)
    file.stream.seek(0)
    detected_mime = magic.from_buffer(header, mime=True)

    if detected_mime not in ALLOWED_MIME_TYPES:
        return jsonify(error=f"Disallowed file type: {detected_mime}"), 400

    # Rename to a random, safe name; extension derived from validated MIME type.
    safe_ext = ALLOWED_MIME_TYPES[detected_mime]
    random_name = secrets.token_hex(16) + safe_ext

    # Resolve the final path and ensure it stays within the upload directory.
    dest_path = os.path.abspath(os.path.join(UPLOAD_DIR, random_name))
    if not dest_path.startswith(UPLOAD_DIR + os.sep):
        return jsonify(error="Invalid storage path"), 400

    # Save the file outside the web root.
    file.save(dest_path)

    # Re-verify size on disk as a final guard against streaming tricks.
    if os.path.getsize(dest_path) > MAX_FILE_SIZE:
        os.remove(dest_path)
        return jsonify(error="File exceeds maximum allowed size"), 413

    return jsonify(
        message="File uploaded successfully",
        stored_name=random_name,
        mime_type=detected_mime,
        size=size,
    ), 201


if __name__ == "__main__":
    app.run(debug=False)