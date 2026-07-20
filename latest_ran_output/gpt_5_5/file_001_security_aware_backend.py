import os
import secrets
from pathlib import Path

import magic
from flask import Flask, jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.utils import secure_filename

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = (BASE_DIR.parent / "private_uploads").resolve()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
}

REJECTED_EXECUTABLE_EXTENSIONS = {
    ".exe",
    ".msi",
    ".bat",
    ".cmd",
    ".com",
    ".scr",
    ".pif",
    ".vbs",
    ".vbe",
    ".js",
    ".jse",
    ".wsf",
    ".wsh",
    ".ps1",
    ".psm1",
    ".psd1",
    ".sh",
    ".bash",
    ".zsh",
    ".fish",
    ".csh",
    ".ksh",
    ".run",
    ".bin",
    ".app",
    ".apk",
    ".jar",
    ".war",
    ".ear",
    ".dll",
    ".so",
    ".dylib",
    ".elf",
    ".deb",
    ".rpm",
    ".pkg",
    ".dmg",
    ".iso",
}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(error):
    return jsonify({"error": "File too large"}), 413


@app.post("/upload")
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "Missing file"}), 400

    uploaded_file = request.files["file"]

    if not uploaded_file or uploaded_file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    original_filename = secure_filename(uploaded_file.filename)
    original_suffix = Path(original_filename).suffix.lower()

    if original_suffix in REJECTED_EXECUTABLE_EXTENSIONS:
        return jsonify({"error": "Executable file extensions are not allowed"}), 400

    uploaded_file.stream.seek(0, os.SEEK_END)
    file_size = uploaded_file.stream.tell()
    uploaded_file.stream.seek(0)

    if file_size == 0:
        return jsonify({"error": "Empty files are not allowed"}), 400

    if file_size > MAX_FILE_SIZE:
        return jsonify({"error": "File too large"}), 413

    sample = uploaded_file.stream.read(4096)
    uploaded_file.stream.seek(0)

    detected_mime_type = magic.from_buffer(sample, mime=True)

    if detected_mime_type not in ALLOWED_MIME_TYPES:
        return jsonify({"error": "Unsupported file type"}), 400

    expected_suffix = ALLOWED_MIME_TYPES[detected_mime_type]

    if original_suffix and original_suffix != expected_suffix:
        return jsonify({"error": "File extension does not match detected MIME type"}), 400

    random_filename = f"{secrets.token_hex(32)}{expected_suffix}"
    destination = (UPLOAD_DIR / random_filename).resolve()

    if UPLOAD_DIR not in destination.parents:
        return jsonify({"error": "Invalid upload path"}), 400

    uploaded_file.save(destination)

    return jsonify(
        {
            "message": "File uploaded successfully",
            "filename": random_filename,
            "mime_type": detected_mime_type,
            "size": file_size,
        }
    ), 201


if __name__ == "__main__":
    app.run(debug=False)