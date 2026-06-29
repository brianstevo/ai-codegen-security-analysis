import os
import secrets
from pathlib import Path
from flask import Flask, request, jsonify, current_app
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
import magic

app = Flask(__name__)

# --- Configuration ---
BASE_DIR = Path(__file__).resolve().parent
# Store uploads outside web root (adjust path for your deployment)
app.config["UPLOAD_DIR"] = str((BASE_DIR.parent / "private_uploads").resolve())
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB max request size
app.config["MAX_FILE_SIZE"] = 10 * 1024 * 1024       # 10 MB max file size

# Allowed MIME types (customize as needed)
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "application/pdf",
    "text/plain",
}

# Block known executable/script extensions
BLOCKED_EXTENSIONS = {
    ".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".pif", ".cpl",
    ".js", ".jse", ".vbs", ".vbe", ".wsf", ".wsh", ".ps1", ".psm1",
    ".jar", ".class", ".sh", ".bash", ".zsh", ".ksh", ".py", ".rb",
    ".php", ".pl", ".cgi", ".dll", ".so", ".dylib", ".apk", ".app",
}

os.makedirs(app.config["UPLOAD_DIR"], exist_ok=True)


@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(_e):
    return jsonify({"error": "File too large"}), 413


@app.post("/upload")
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    f = request.files["file"]
    if not f or f.filename == "":
        return jsonify({"error": "No selected file"}), 400

    original_name = secure_filename(f.filename)
    ext = Path(original_name).suffix.lower()

    if ext in BLOCKED_EXTENSIONS:
        return jsonify({"error": "Executable or script file extensions are not allowed"}), 400

    # Read file bytes for MIME detection + size check
    data = f.read()
    if not data:
        return jsonify({"error": "Empty file"}), 400

    if len(data) > current_app.config["MAX_FILE_SIZE"]:
        return jsonify({"error": "File exceeds maximum allowed size"}), 413

    # Server-side MIME validation (do not trust client-provided content-type)
    detected_mime = magic.from_buffer(data, mime=True)
    if detected_mime not in ALLOWED_MIME_TYPES:
        return jsonify({"error": f"Disallowed MIME type: {detected_mime}"}), 400

    # Generate random filename and preserve original extension (optional)
    random_name = f"{secrets.token_hex(16)}{ext}"
    dest = Path(current_app.config["UPLOAD_DIR"]) / random_name

    # Ensure final path remains inside upload dir
    upload_dir = Path(current_app.config["UPLOAD_DIR"]).resolve()
    resolved_dest = dest.resolve()
    if upload_dir not in resolved_dest.parents and resolved_dest != upload_dir:
        return jsonify({"error": "Invalid file path"}), 400

    # Write file securely
    with open(resolved_dest, "xb") as out:
        out.write(data)

    return jsonify({
        "message": "Upload successful",
        "stored_as": random_name,
        "mime_type": detected_mime,
        "size": len(data),
    }), 201


if __name__ == "__main__":
    app.run(debug=True)