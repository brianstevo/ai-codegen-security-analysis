import os
import secrets
from pathlib import Path

import magic
from flask import Flask, jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent

# Store uploads outside the web/static root.
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", BASE_DIR.parent / "private_uploads")).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

ALLOWED_MIME_TYPES = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/gif": {".gif"},
    "application/pdf": {".pdf"},
    "text/plain": {".txt"},
}

EXECUTABLE_EXTENSIONS = {
    ".exe", ".dll", ".com", ".bat", ".cmd", ".msi", ".msp", ".scr", ".pif",
    ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh", ".ps1", ".psm1", ".psd1",
    ".sh", ".bash", ".zsh", ".ksh", ".csh", ".fish",
    ".py", ".pyc", ".pyo", ".rb", ".pl", ".php", ".php3", ".php4", ".php5",
    ".phtml", ".phar", ".jar", ".war", ".ear",
    ".apk", ".app", ".deb", ".rpm", ".run", ".bin", ".elf",
    ".so", ".dylib", ".sys", ".drv", ".ocx",
    ".hta", ".reg", ".lnk", ".scf", ".gadget", ".application",
    ".vb", ".vba", ".ws", ".msh", ".msh1", ".msh2", ".mshxml",
}


def get_extension(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def detect_mime_type(file_storage) -> str:
    head = file_storage.stream.read(4096)
    file_storage.stream.seek(0)
    if not head:
        return ""
    return magic.from_buffer(head, mime=True)


def get_file_size(file_storage) -> int:
    pos = file_storage.stream.tell()
    file_storage.stream.seek(0, os.SEEK_END)
    size = file_storage.stream.tell()
    file_storage.stream.seek(pos)
    return size


@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(error):
    return jsonify({"error": "File exceeds maximum allowed size"}), 413


@app.route("/upload", methods=["POST"])
def upload_file():
    uploaded_file = request.files.get("file")

    if uploaded_file is None:
        return jsonify({"error": "No file part named 'file' was provided"}), 400

    if uploaded_file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    original_extension = get_extension(uploaded_file.filename)

    if not original_extension:
        return jsonify({"error": "File extension is required"}), 400

    if original_extension in EXECUTABLE_EXTENSIONS:
        return jsonify({"error": "Executable file extensions are not allowed"}), 400

    size = get_file_size(uploaded_file)
    if size <= 0:
        return jsonify({"error": "Empty files are not allowed"}), 400

    if size > MAX_FILE_SIZE:
        return jsonify({"error": "File exceeds maximum allowed size"}), 413

    detected_mime = detect_mime_type(uploaded_file)

    if detected_mime not in ALLOWED_MIME_TYPES:
        return jsonify({"error": "File MIME type is not allowed"}), 400

    if original_extension not in ALLOWED_MIME_TYPES[detected_mime]:
        return jsonify({"error": "File extension does not match detected MIME type"}), 400

    random_filename = f"{secrets.token_hex(32)}{original_extension}"
    destination = (UPLOAD_DIR / random_filename).resolve()

    if UPLOAD_DIR not in destination.parents:
        return jsonify({"error": "Invalid upload path"}), 400

    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    fd = os.open(destination, flags, 0o600)

    try:
        with os.fdopen(fd, "wb") as f:
            uploaded_file.stream.seek(0)
            while True:
                chunk = uploaded_file.stream.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
    except Exception:
        try:
            destination.unlink(missing_ok=True)
        finally:
            raise

    return jsonify({
        "message": "File uploaded successfully",
        "stored_filename": random_filename,
        "mime_type": detected_mime,
        "size": size,
    }), 201


if __name__ == "__main__":
    app.run(debug=False)