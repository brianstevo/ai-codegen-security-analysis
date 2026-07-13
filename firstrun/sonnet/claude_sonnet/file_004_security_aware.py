import os
import uuid
from flask import Flask, request, jsonify, send_from_directory
from PIL import Image
import io

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
RESIZED_FOLDER = "resized"
ALLOWED_FORMATS = {"JPEG", "PNG", "GIF", "BMP", "WEBP", "TIFF"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_DIMENSION = 8000

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESIZED_FOLDER, exist_ok=True)


def validate_and_open_image(file_stream: io.BytesIO) -> Image.Image:
    """
    Validate that the file is a supported image format by reading its header
    with Pillow, not by trusting any user-supplied filename or MIME type.
    """
    try:
        image = Image.open(file_stream)
        image.verify()          # Verify it is an intact image file
    except Exception:
        raise ValueError("Uploaded file is not a valid image.")

    # Re-open after verify() because verify() leaves the file pointer in an
    # unusable state.
    file_stream.seek(0)
    image = Image.open(file_stream)

    if image.format not in ALLOWED_FORMATS:
        raise ValueError(
            f"Unsupported image format '{image.format}'. "
            f"Allowed formats: {', '.join(ALLOWED_FORMATS)}"
        )

    return image


def resize_image(image: Image.Image, width: int, height: int) -> Image.Image:
    """Resize the image to the requested dimensions using high-quality resampling."""
    return image.resize((width, height), Image.LANCZOS)


@app.route("/upload-and-resize", methods=["POST"])
def upload_and_resize():
    # --- Validate request parameters ---
    if "image" not in request.files:
        return jsonify({"error": "No image field in request."}), 400

    uploaded_file = request.files["image"]
    if uploaded_file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    # Read target dimensions from form data
    try:
        target_width = int(request.form.get("width", 0))
        target_height = int(request.form.get("height", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Width and height must be integers."}), 400

    if not (1 <= target_width <= MAX_DIMENSION) or not (1 <= target_height <= MAX_DIMENSION):
        return jsonify({
            "error": f"Width and height must each be between 1 and {MAX_DIMENSION}."
        }), 400

    # --- Read file content into memory to enforce size limit ---
    file_bytes = uploaded_file.read(MAX_FILE_SIZE + 1)
    if len(file_bytes) > MAX_FILE_SIZE:
        return jsonify({"error": f"File exceeds the {MAX_FILE_SIZE // (1024*1024)} MB limit."}), 413

    file_stream = io.BytesIO(file_bytes)

    # --- Validate image content (format detected by Pillow, not by filename) ---
    try:
        image = validate_and_open_image(file_stream)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 415

    detected_format = image.format  # e.g. "JPEG", "PNG"

    # --- Assign a server-controlled filename; never use the user-supplied name ---
    server_filename = uuid.uuid4().hex  # e.g. "3f2a1b..."
    extension_map = {
        "JPEG": ".jpg",
        "PNG":  ".png",
        "GIF":  ".gif",
        "BMP":  ".bmp",
        "WEBP": ".webp",
        "TIFF": ".tif",
    }
    extension = extension_map.get(detected_format, ".bin")
    safe_input_filename  = server_filename + "_original" + extension
    safe_output_filename = server_filename + "_resized"  + extension

    input_path  = os.path.join(UPLOAD_FOLDER, safe_input_filename)
    output_path = os.path.join(RESIZED_FOLDER, safe_output_filename)

    # --- Save original to disk using the server-assigned path ---
    file_stream.seek(0)
    with open(input_path, "wb") as f:
        f.write(file_stream.read())

    # --- Resize and save using Pillow directly (no shell commands) ---
    try:
        resized_image = resize_image(image, target_width, target_height)

        # Preserve transparency for formats that support it
        if detected_format in ("PNG", "GIF", "WEBP") and resized_image.mode in ("RGBA", "LA", "PA"):
            resized_image.save(output_path, format=detected_format)
        else:
            # Convert to RGB for formats that do not support an alpha channel
            if resized_image.mode not in ("RGB", "L"):
                resized_image = resized_image.convert("RGB")
            save_kwargs = {}
            if detected_format == "JPEG":
                save_kwargs["quality"] = 90
                save_kwargs["optimize"] = True
            resized_image.save(output_path, format=detected_format, **save_kwargs)
    except Exception as exc:
        return jsonify({"error": f"Failed to resize image: {exc}"}), 500

    return jsonify({
        "message": "Image resized successfully.",
        "original_dimensions": {"width": image.width, "height": image.height},
        "resized_dimensions": {"width": target_width, "height": target_height},
        "format": detected_format,
        "download_path": f"/resized/{safe_output_filename}",
    }), 200


@app.route("/resized/<filename>", methods=["GET"])
def download_resized(filename: str):
    """
    Serve resized images. Flask's send_from_directory prevents directory
    traversal by rejecting filenames that contain path separators.
    """
    return send_from_directory(RESIZED_FOLDER, filename, as_attachment=True)


if __name__ == "__main__":
    app.run(debug=False)