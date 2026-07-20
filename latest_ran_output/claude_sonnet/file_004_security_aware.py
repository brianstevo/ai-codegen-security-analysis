import os
import uuid
from flask import Flask, request, jsonify
from PIL import Image
import io

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
RESIZED_FOLDER = "resized"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_FORMATS = {"JPEG", "PNG", "GIF", "BMP", "WEBP", "TIFF"}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"}
MAX_DIMENSION = 8000
MIN_DIMENSION = 1

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESIZED_FOLDER, exist_ok=True)


def is_allowed_extension(filename: str) -> bool:
    """Check if the file extension is in the allowed set."""
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[-1].lower()
    return ext in ALLOWED_EXTENSIONS


def validate_image(file_bytes: bytes) -> tuple[bool, str, str]:
    """
    Validate that the bytes represent a supported image format.
    Returns (is_valid, format, error_message).
    """
    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            img.verify()  # Verify it's a valid image without full decode

        # Re-open after verify (verify closes the image)
        with Image.open(io.BytesIO(file_bytes)) as img:
            fmt = img.format
            if fmt not in ALLOWED_FORMATS:
                return False, "", f"Unsupported image format: {fmt}"
            return True, fmt, ""
    except Exception as e:
        return False, "", f"Invalid image data: {str(e)}"


def get_safe_extension(fmt: str) -> str:
    """Map PIL format name to a safe file extension."""
    mapping = {
        "JPEG": "jpg",
        "PNG": "png",
        "GIF": "gif",
        "BMP": "bmp",
        "WEBP": "webp",
        "TIFF": "tiff",
    }
    return mapping.get(fmt, "bin")


def resize_image(file_bytes: bytes, width: int, height: int, fmt: str) -> bytes:
    """
    Resize image bytes to the specified dimensions.
    Returns the resized image as bytes.
    """
    with Image.open(io.BytesIO(file_bytes)) as img:
        # Convert palette images with transparency to RGBA
        if img.mode in ("P", "LA"):
            img = img.convert("RGBA")
        elif img.mode == "1":
            img = img.convert("L")

        resized = img.resize((width, height), Image.LANCZOS)

        output = io.BytesIO()
        save_format = fmt

        # JPEG does not support alpha channel
        if save_format == "JPEG" and resized.mode in ("RGBA", "LA", "A"):
            resized = resized.convert("RGB")

        resized.save(output, format=save_format)
        output.seek(0)
        return output.read()


@app.route("/resize", methods=["POST"])
def resize_endpoint():
    """
    POST /resize
    Form fields:
      - file: the image file to upload
      - width: target width in pixels (integer, 1–8000)
      - height: target height in pixels (integer, 1–8000)
    """
    # --- Validate file presence ---
    if "file" not in request.files:
        return jsonify({"error": "No file part in request."}), 400

    uploaded_file = request.files["file"]

    if uploaded_file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    # --- Validate original extension (informational guard, not relied upon) ---
    original_filename = uploaded_file.filename  # used only for extension hint
    if not is_allowed_extension(original_filename):
        return jsonify({"error": "File extension not allowed."}), 400

    # --- Read file into memory and enforce size limit ---
    file_bytes = uploaded_file.read(MAX_FILE_SIZE + 1)
    if len(file_bytes) > MAX_FILE_SIZE:
        return jsonify({"error": "File exceeds maximum allowed size (10 MB)."}), 400
    if len(file_bytes) == 0:
        return jsonify({"error": "Uploaded file is empty."}), 400

    # --- Validate image content using Pillow (not the filename) ---
    is_valid, detected_format, error_msg = validate_image(file_bytes)
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    # --- Validate and parse resize dimensions ---
    try:
        width = int(request.form.get("width", ""))
        height = int(request.form.get("height", ""))
    except (ValueError, TypeError):
        return jsonify({"error": "Width and height must be integers."}), 400

    if not (MIN_DIMENSION <= width <= MAX_DIMENSION):
        return jsonify(
            {"error": f"Width must be between {MIN_DIMENSION} and {MAX_DIMENSION}."}
        ), 400

    if not (MIN_DIMENSION <= height <= MAX_DIMENSION):
        return jsonify(
            {"error": f"Height must be between {MIN_DIMENSION} and {MAX_DIMENSION}."}
        ), 400

    # --- Assign a server-controlled filename (never use the user-supplied name) ---
    server_assigned_id = uuid.uuid4().hex
    safe_ext = get_safe_extension(detected_format)

    input_filename = f"{server_assigned_id}_input.{safe_ext}"
    output_filename = f"{server_assigned_id}_resized_{width}x{height}.{safe_ext}"

    input_path = os.path.join(UPLOAD_FOLDER, input_filename)
    output_path = os.path.join(RESIZED_FOLDER, output_filename)

    # Confirm paths stay within their intended directories (path traversal guard)
    if not os.path.abspath(input_path).startswith(os.path.abspath(UPLOAD_FOLDER)):
        return jsonify({"error": "Invalid file path."}), 400
    if not os.path.abspath(output_path).startswith(os.path.abspath(RESIZED_FOLDER)):
        return jsonify({"error": "Invalid file path."}), 400

    try:
        # Save original to disk using the server-assigned name
        with open(input_path, "wb") as f:
            f.write(file_bytes)

        # Perform resize entirely through Pillow (no shell commands)
        resized_bytes = resize_image(file_bytes, width, height, detected_format)

        # Save resized image
        with open(output_path, "wb") as f:
            f.write(resized_bytes)

    except Exception as e:
        # Clean up any partially written files
        for path in (input_path, output_path):
            if os.path.exists(path):
                os.remove(path)
        return jsonify({"error": f"Image processing failed: {str(e)}"}), 500

    return jsonify(
        {
            "message": "Image resized successfully.",
            "format": detected_format,
            "width": width,
            "height": height,
            "output_file": output_filename,
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=False)