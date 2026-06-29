import os
import uuid
from io import BytesIO

from flask import Flask, request, jsonify
from PIL import Image, UnidentifiedImageError

app = Flask(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Supported formats mapped to safe file extensions.
SUPPORTED_FORMATS = {
    "JPEG": "jpg",
    "PNG": "png",
    "GIF": "gif",
    "BMP": "bmp",
    "WEBP": "webp",
}

MAX_DIMENSION = 4096
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def _server_assigned_filename(extension: str) -> str:
    """Generate a random, server-controlled filename. The original
    (user-controlled) filename is never used for storage."""
    return f"{uuid.uuid4().hex}.{extension}"


def resize_uploaded_image(file_storage, width: int, height: int) -> str:
    """
    Validate and resize an uploaded image using Pillow.

    - Reads the upload into memory and verifies it is a supported image
      format before any processing (no trusting of the client-provided
      filename or content type).
    - Never invokes any shell command with user-controlled data.
    - Saves the result under a server-assigned random filename.

    Returns the absolute path of the saved, resized image.
    Raises ValueError on invalid input.
    """
    if file_storage is None or file_storage.filename == "":
        raise ValueError("No file provided.")

    raw = file_storage.read()
    if not raw:
        raise ValueError("Empty upload.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ValueError("Upload exceeds maximum allowed size.")

    # Validate dimensions (must be sane integers).
    try:
        width = int(width)
        height = int(height)
    except (TypeError, ValueError):
        raise ValueError("Width and height must be integers.")
    if width <= 0 or height <= 0:
        raise ValueError("Width and height must be positive.")
    if width > MAX_DIMENSION or height > MAX_DIMENSION:
        raise ValueError("Requested dimensions are too large.")

    # First pass: verify the bytes are a genuine, supported image.
    try:
        with Image.open(BytesIO(raw)) as probe:
            probe.verify()  # integrity check; does not decode pixel data
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValueError("Uploaded file is not a valid image.")

    # Reopen for actual processing (verify() leaves the image unusable).
    try:
        image = Image.open(BytesIO(raw))
        fmt = (image.format or "").upper()
    except (UnidentifiedImageError, OSError):
        raise ValueError("Uploaded file is not a valid image.")

    if fmt not in SUPPORTED_FORMATS:
        raise ValueError(f"Unsupported image format: {fmt or 'unknown'}.")

    extension = SUPPORTED_FORMATS[fmt]

    # Convert modes that some formats can't save directly.
    if fmt in ("JPEG", "BMP") and image.mode in ("RGBA", "P", "LA"):
        image = image.convert("RGB")

    resized = image.resize((width, height), Image.LANCZOS)

    server_filename = _server_assigned_filename(extension)
    output_path = os.path.join(UPLOAD_DIR, server_filename)

    # Save via Pillow directly — no shell, no subprocess, no user filename.
    save_format = "JPEG" if fmt == "JPEG" else fmt
    resized.save(output_path, format=save_format)

    return output_path


@app.route("/resize", methods=["POST"])
def resize_endpoint():
    uploaded = request.files.get("image")
    width = request.form.get("width")
    height = request.form.get("height")

    try:
        saved_path = resize_uploaded_image(uploaded, width, height)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"filename": os.path.basename(saved_path)}), 201


if __name__ == "__main__":
    app.run()