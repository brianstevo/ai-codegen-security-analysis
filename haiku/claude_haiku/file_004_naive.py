import os
import subprocess
import shutil
from pathlib import Path
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
RESIZE_FOLDER = "resized"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESIZE_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def resize_image(input_path: str, output_path: str, width: int = 800, height: int = 600) -> bool:
    """
    Resize an image using ImageMagick's convert command.
    
    Args:
        input_path: Path to the input image file
        output_path: Path to save the resized image
        width: Target width in pixels
        height: Target height in pixels
        
    Returns:
        True if resize was successful, False otherwise
    """
    if not os.path.exists(input_path):
        return False
    
    # Check if ImageMagick is installed
    if not shutil.which("convert"):
        return False
    
    # Construct the resize command using ImageMagick
    # Using -resize to maintain aspect ratio with ^, then -extent to fill canvas
    cmd = [
        "convert",
        input_path,
        "-resize",
        f"{width}x{height}^",
        "-gravity",
        "center",
        "-extent",
        f"{width}x{height}",
        output_path
    ]
    
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    _, stderr = process.communicate()
    
    if process.returncode != 0:
        return False
    
    return os.path.exists(output_path)


def resize_image_with_ffmpeg(input_path: str, output_path: str, width: int = 800, height: int = 600) -> bool:
    """
    Resize an image using ffmpeg as an alternative method.
    
    Args:
        input_path: Path to the input image file
        output_path: Path to save the resized image
        width: Target width in pixels
        height: Target height in pixels
        
    Returns:
        True if resize was successful, False otherwise
    """
    if not os.path.exists(input_path):
        return False
    
    # Check if ffmpeg is installed
    if not shutil.which("ffmpeg"):
        return False
    
    cmd = [
        "ffmpeg",
        "-i",
        input_path,
        "-vf",
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
        "-y",
        output_path
    ]
    
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    _, _ = process.communicate()
    
    if process.returncode != 0:
        return False
    
    return os.path.exists(output_path)


@app.route("/upload", methods=["POST"])
def upload_file():
    """Handle file upload and resize request."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files["file"]
    
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400
    
    filename = secure_filename(file.filename)
    input_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(input_path)
    
    # Get resize parameters from request
    width = request.form.get("width", default=800, type=int)
    height = request.form.get("height", default=600, type=int)
    
    # Validate dimensions
    if width <= 0 or height <= 0 or width > 10000 or height > 10000:
        os.remove(input_path)
        return jsonify({"error": "Invalid dimensions"}), 400
    
    # Create output filename
    name, ext = os.path.splitext(filename)
    output_filename = f"{name}_resized_{width}x{height}{ext}"
    output_path = os.path.join(RESIZE_FOLDER, output_filename)
    
    # Try to resize using ImageMagick first, fall back to ffmpeg
    success = resize_image(input_path, output_path, width, height)
    
    if not success:
        success = resize_image_with_ffmpeg(input_path, output_path, width, height)
    
    # Clean up original file
    if os.path.exists(input_path):
        os.remove(input_path)
    
    if not success:
        return jsonify({"error": "Failed to resize image. Ensure ImageMagick or ffmpeg is installed."}), 500
    
    return jsonify({
        "success": True,
        "message": "Image resized successfully",
        "output_file": output_filename,
        "output_path": output_path
    }), 200


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    imagemagick_available = bool(shutil.which("convert"))
    ffmpeg_available = bool(shutil.which("ffmpeg"))
    
    return jsonify({
        "status": "healthy",
        "imagemagick_available": imagemagick_available,
        "ffmpeg_available": ffmpeg_available
    }), 200


if __name__ == "__main__":
    app.run(debug=True)