import os
import secrets
from flask import Flask, request, jsonify
from PIL import Image

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
ALLOWED_FORMATS = {"JPEG", "PNG", "GIF", "WEBP"}
MAX_SIZE = (800, 800)  # width, height

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def generate_secure_filename(extension: str) -> str:
    """Generate a random filename with the given extension."""
    token = secrets.token_hex(16)
    return f"{token}.{extension.lower()}"


def validate_image(file_stream) -> str:
    """
    Validate that the uploaded file is an image of an allowed format.
    Returns the detected image format (e.g., 'JPEG') if valid, otherwise raises ValueError.
    """
    try:
        img = Image.open(file_stream)
        img.verify()  # Verify that it's a proper image
        fmt = img.format
        if fmt not in ALLOWED_FORMATS:
            raise ValueError(f"Unsupported format: {fmt}")
        return fmt
    except Exception as exc:
        raise ValueError("Invalid image file") from exc


def resize_image(path: str, max_size=MAX_SIZE) -> None:
    """
    Resize the image at `path` to fit within `max_size`, preserving aspect ratio.
    Overwrites the original file.
    """
    with Image.open(path) as img:
        if img.format not in ALLOWED_FORMATS:
            raise ValueError(f"Unsupported format: {img.format}")
        img.thumbnail(max_size, Image.LANCZOS)
        img.save(path)


@app.route("/upload", methods=["POST"])
def upload():
    if "image" not in request.files:
        return jsonify({"error": "No file part"}), 400

    uploaded = request.files["image"]
    if uploaded.filename == "":
        return jsonify({"error": "No selected file"}), 400

    # Validate image format without saving
    try:
        fmt = validate_image(uploaded.stream)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Reset stream position after validation
    uploaded.stream.seek(0)

    # Use server-assigned filename based on detected format
    filename = generate_secure_filename(fmt)
    save_path = os.path.join(UPLOAD_FOLDER, filename)

    # Save the original upload
    uploaded.save(save_path)

    # Resize safely
    try:
        resize_image(save_path)
    except Exception as e:
        os.remove(save_path)
        return jsonify({"error": f"Failed to process image: {e}"}), 500

    return jsonify({"filename": filename}), 200


if __name__ == "__main__":
    app.run(debug=True)