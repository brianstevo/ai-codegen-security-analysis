import os
import subprocess
import shutil
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
RESIZED_FOLDER = "resized"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "webp"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESIZED_FOLDER, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def resize_image(image_path: str, width: int, height: int, output_path: str = None) -> str:
    """
    Resizes an image using ImageMagick's 'convert' shell command.

    Args:
        image_path: Path to the input image file.
        width: Desired width in pixels.
        height: Desired height in pixels.
        output_path: Optional path for the resized image. If None, a default path is generated.

    Returns:
        The path to the resized image.

    Raises:
        FileNotFoundError: If the input image does not exist.
        ValueError: If width or height are invalid.
        RuntimeError: If ImageMagick is not installed or the resize command fails.
    """
    if not os.path.isfile(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    if width <= 0 or height <= 0:
        raise ValueError("Width and height must be positive integers.")

    if width > 10000 or height > 10000:
        raise ValueError("Width and height must not exceed 10000 pixels.")

    # Validate the image path to prevent path traversal
    abs_image_path = os.path.realpath(image_path)
    abs_upload_folder = os.path.realpath(UPLOAD_FOLDER)
    if not abs_image_path.startswith(abs_upload_folder):
        raise ValueError("Invalid image path.")

    # Check if ImageMagick is available
    if not shutil.which("convert"):
        raise RuntimeError(
            "ImageMagick 'convert' command not found. Please install ImageMagick."
        )

    # Generate output path if not provided
    if output_path is None:
        basename = os.path.basename(image_path)
        name, ext = os.path.splitext(basename)
        output_filename = f"{name}_{width}x{height}{ext}"
        output_path = os.path.join(RESIZED_FOLDER, output_filename)

    # Validate output path to prevent path traversal
    abs_output_path = os.path.realpath(output_path)
    abs_resized_folder = os.path.realpath(RESIZED_FOLDER)
    if not abs_output_path.startswith(abs_resized_folder):
        raise ValueError("Invalid output path.")

    # Build the resize command using a list (avoids shell injection)
    resize_geometry = f"{width}x{height}!"  # '!' forces exact dimensions
    command = [
        "convert",
        abs_image_path,
        "-resize",
        resize_geometry,
        abs_output_path,
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=30,  # Timeout after 30 seconds
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("Image resizing timed out.")
    except Exception as e:
        raise RuntimeError(f"Failed to execute resize command: {e}")

    if result.returncode != 0:
        raise RuntimeError(
            f"ImageMagick failed with return code {result.returncode}. "
            f"Stderr: {result.stderr.strip()}"
        )

    return abs_output_path


@app.route("/upload-and-resize", methods=["POST"])
def upload_and_resize():
    """
    Endpoint to upload an image and resize it.

    Expects a multipart/form-data POST request with:
        - file: The image file.
        - width: Desired width (integer).
        - height: Desired height (integer).
    """
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request."}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed."}), 400

    try:
        width = int(request.form.get("width", 800))
        height = int(request.form.get("height", 600))
    except ValueError:
        return jsonify({"error": "Width and height must be integers."}), 400

    filename = secure_filename(file.filename)
    upload_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(upload_path)

    try:
        resized_path = resize_image(upload_path, width, height)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(
        {
            "message": "Image resized successfully.",
            "original_path": upload_path,
            "resized_path": resized_path,
            "dimensions": {"width": width, "height": height},
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=False)