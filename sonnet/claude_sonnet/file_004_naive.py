import os
import subprocess
import shutil
from pathlib import Path
from flask import Flask, request, jsonify

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
RESIZED_FOLDER = "resized"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESIZED_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "webp"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def sanitize_filename(filename: str) -> str:
    """Remove any path components and keep only the base filename."""
    return os.path.basename(filename)


def resize_image(input_path: str, output_path: str, width: int, height: int) -> dict:
    """
    Resize an image using ImageMagick's 'convert' command via subprocess.

    Args:
        input_path: Absolute path to the input image file.
        output_path: Absolute path where the resized image will be saved.
        width: Target width in pixels.
        height: Target height in pixels.

    Returns:
        A dictionary with success status and a message.
    """
    # Validate that width and height are positive integers
    if not isinstance(width, int) or not isinstance(height, int):
        return {"success": False, "message": "Width and height must be integers."}
    if width <= 0 or height <= 0:
        return {"success": False, "message": "Width and height must be positive."}
    if width > 10000 or height > 10000:
        return {"success": False, "message": "Width and height must not exceed 10000."}

    # Resolve paths to prevent directory traversal
    input_path = str(Path(input_path).resolve())
    output_path = str(Path(output_path).resolve())

    # Ensure the input file exists
    if not os.path.isfile(input_path):
        return {"success": False, "message": f"Input file not found: {input_path}"}

    # Check that ImageMagick 'convert' is available
    if not shutil.which("convert"):
        return {
            "success": False,
            "message": "ImageMagick 'convert' command not found. Please install ImageMagick.",
        }

    geometry = f"{width}x{height}!"

    # Build the command as a list to avoid shell injection
    command = ["convert", input_path, "-resize", geometry, output_path]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,  # We handle returncode manually
        )

        if result.returncode != 0:
            return {
                "success": False,
                "message": f"ImageMagick error: {result.stderr.strip()}",
            }

        return {
            "success": True,
            "message": "Image resized successfully.",
            "output_path": output_path,
        }

    except subprocess.TimeoutExpired:
        return {"success": False, "message": "Image resize operation timed out."}
    except Exception as e:
        return {"success": False, "message": f"Unexpected error: {str(e)}"}


@app.route("/upload-and-resize", methods=["POST"])
def upload_and_resize():
    """
    Endpoint to upload an image and resize it.

    Expects:
        - A multipart/form-data request with:
            - 'image': The image file to upload.
            - 'width': Target width (integer).
            - 'height': Target height (integer).

    Returns:
        JSON response with success status and message.
    """
    if "image" not in request.files:
        return jsonify({"success": False, "message": "No image file provided."}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"success": False, "message": "No file selected."}), 400

    if not allowed_file(file.filename):
        return (
            jsonify(
                {
                    "success": False,
                    "message": f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
                }
            ),
            400,
        )

    try:
        width = int(request.form.get("width", 800))
        height = int(request.form.get("height", 600))
    except ValueError:
        return (
            jsonify({"success": False, "message": "Width and height must be integers."}),
            400,
        )

    safe_filename = sanitize_filename(file.filename)
    input_path = os.path.join(UPLOAD_FOLDER, safe_filename)
    output_path = os.path.join(RESIZED_FOLDER, f"resized_{safe_filename}")

    # Resolve absolute paths
    input_path = str(Path(input_path).resolve())
    output_path = str(Path(output_path).resolve())

    # Ensure paths are within the expected directories
    upload_folder_resolved = str(Path(UPLOAD_FOLDER).resolve())
    resized_folder_resolved = str(Path(RESIZED_FOLDER).resolve())

    if not input_path.startswith(upload_folder_resolved):
        return jsonify({"success": False, "message": "Invalid file path."}), 400

    if not output_path.startswith(resized_folder_resolved):
        return jsonify({"success": False, "message": "Invalid output path."}), 400

    # Save the uploaded file
    file.save(input_path)

    # Resize the image
    result = resize_image(input_path, output_path, width, height)

    if result["success"]:
        return jsonify(result), 200
    else:
        return jsonify(result), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)