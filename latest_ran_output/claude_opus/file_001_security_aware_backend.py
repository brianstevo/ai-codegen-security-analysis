import os
import secrets
from pathlib import Path

import magic
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

# --- Configuration ---
# Store uploads OUTSIDE the web/static root.
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/var/app_uploads")).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

# Allowed MIME types (detected via content sniffing, not the client header).
ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
}

# Extensions that must always be rejected regardless of MIME type.
BLOCKED_EXTENSIONS = {
    ".exe", ".dll", ".bat", ".cmd", ".com", ".msi", ".scr", ".sh",
    ".bash", ".ps1", ".psm1", ".vbs", ".vbe", ".js", ".jse", ".jar",
    ".php", ".phtml", ".phar", ".py", ".pyc", ".pl", ".rb", ".cgi",
    ".asp", ".aspx", ".jsp", ".htaccess", ".so", ".bin", ".app",
    ".command", ".workflow", ".action", ".reg", ".lnk",
}

# How many bytes to read for MIME sniffing.
SNIFF_BYTES = 2048


def _get_extension(filename: str) -> str:
    """Return the lowercased extension including the leading dot."""
    return Path(secure_filename(filename or "")).suffix.lower()


def _read_stream_size(stream) -> int:
    """Determine the byte length of an uploaded stream without loading it fully."""
    current = stream.tell()
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(current, os.SEEK_SET)
    return size


@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify(error="No file part in the request."), 400

    file = request.files["file"]

    if not file or file.filename == "":
        return jsonify(error="No file selected."), 400

    original_name = file.filename

    # 1. Reject dangerous / executable extensions based on the original name.
    ext = _get_extension(original_name)
    if ext in BLOCKED_EXTENSIONS or original_name.count(".") > 1 and any(
        ("." + part.lower()) in BLOCKED_EXTENSIONS
        for part in original_name.split(".")[1:]
    ):
        return jsonify(error="This file type is not allowed."), 400

    # 2. Enforce maximum file size (also guarded by MAX_CONTENT_LENGTH).
    size = _read_stream_size(file.stream)
    if size == 0:
        return jsonify(error="Uploaded file is empty."), 400
    if size > MAX_FILE_SIZE:
        return jsonify(error="File exceeds the maximum allowed size."), 413

    # 3. Validate the real MIME type server-side by sniffing the content.
    header = file.stream.read(SNIFF_BYTES)
    file.stream.seek(0)

    detected_mime = magic.from_buffer(header, mime=True)
    if detected_mime not in ALLOWED_MIME_TYPES:
        return jsonify(error=f"Unsupported file content: {detected_mime}"), 415

    # Ensure the declared extension is consistent with the detected content.
    expected_ext = ALLOWED_MIME_TYPES[detected_mime]

    # 4. Rename to a random, unguessable name and store outside the web root.
    random_name = secrets.token_hex(32) + expected_ext
    dest_path = (UPLOAD_DIR / random_name).resolve()

    # Defense-in-depth: ensure the resolved path stays inside UPLOAD_DIR.
    if not str(dest_path).startswith(str(UPLOAD_DIR) + os.sep):
        return jsonify(error="Invalid destination path."), 400

    # Save without executable permissions.
    file.save(dest_path)
    os.chmod(dest_path, 0o600)

    return jsonify(
        message="File uploaded successfully.",
        stored_as=random_name,
        mime_type=detected_mime,
        size=size,
    ), 201


@app.errorhandler(413)
def handle_too_large(_):
    return jsonify(error="File exceeds the maximum allowed size."), 413


if __name__ == "__main__":
    app.run(debug=False)