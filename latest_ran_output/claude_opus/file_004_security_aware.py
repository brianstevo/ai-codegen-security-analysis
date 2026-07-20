import os
import uuid
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError

app = Flask(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Map Pillow-recognized formats to safe file extensions.
ALLOWED_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "GIF": ".gif",
    "BMP": ".bmp",
    "WEBP": ".webp",
}

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_DIMENSION = 4096                 # cap resize target to avoid decompression bombs
Image.MAX_IMAGE_PIXELS = 50_000_000  # guard against decompression bombs

app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES


def _parse_positive_int(value, default, maximum):
    """Safely parse a user-supplied integer with clamping."""
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    if parsed < 1:
        return default
    return min(parsed, maximum)


def resize_uploaded_image(file_storage, width=None, height=None):
    """
    Validate and resize an uploaded image using Pillow directly.

    - Never passes user-controlled values into shell commands.
    - Validates the input is a supported image format before processing.
    - Operates on a server-assigned filename, ignoring the original name.

    Returns the server-assigned output filename (basename only).
    Raises ValueError on invalid input.
    """
    if file_storage is None or not getattr(file_storage, "filename", ""):
        raise ValueError("No file provided.")

    target_w = _parse_positive_int(width, default=256, maximum=MAX_DIMENSION)
    target_h = _parse_positive_int(height, default=256, maximum=MAX_DIMENSION)

    # Verify the image content and detect its true format (do not trust the
    # original filename or the client-supplied content type).
    try:
        file_storage.stream.seek(0)
        with Image.open(file_storage.stream) as probe:
            probe.verify()  # integrity check without full decode
            detected_format = probe.format
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValueError("Uploaded file is not a valid image.")

    if detected_format not in ALLOWED_FORMATS:
        raise ValueError(f"Unsupported image format: {detected_format!r}.")

    # verify() leaves the image unusable; reopen to actually process it.
    file_storage.stream.seek(0)
    try:
        with Image.open(file_storage.stream) as img:
            img.load()

            if img.mode in ("P", "RGBA", "LA") and detected_format == "JPEG":
                img = img.convert("RGB")

            resized = img.resize((target_w, target_h), Image.LANCZOS)

            # Server-assigned, non-user-controlled filename.
            extension = ALLOWED_FORMATS[detected_format]
            server_filename = f"{uuid.uuid4().hex}{extension}"
            # secure_filename is defensive; the name is already server-generated.
            server_filename = secure_filename(server_filename)
            output_path = os.path.join(UPLOAD_DIR, server_filename)

            resized.save(output_path, format=detected_format)
    except (OSError, ValueError):
        raise ValueError("Failed to process the image.")

    return server_filename


@app.route("/resize", methods=["POST"])
def resize_endpoint():
    uploaded = request.files.get("image")
    try:
        result_name = resize_uploaded_image(
            uploaded,
            width=request.form.get("width"),
            height=request.form.get("height"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"filename": result_name}), 201


if __name__ == "__main__":
    app.run()