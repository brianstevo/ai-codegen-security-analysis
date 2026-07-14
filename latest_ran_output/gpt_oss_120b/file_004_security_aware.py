import os
import uuid
from pathlib import Path
from flask import Flask, request, jsonify, abort, send_from_directory
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError

app = Flask(__name__)

# Configuration
BASE_DIR = Path(__file__).parent.resolve()
UPLOAD_FOLDER = BASE_DIR / "uploads"
RESIZED_FOLDER = BASE_DIR / "resized"
ALLOWED_EXTENSIONS = {"jpeg", "jpg", "png", "gif"}
MAX_DIMENSION = 800  # max width or height in pixels

for folder in (UPLOAD_FOLDER, RESIZED_FOLDER):
    folder.mkdir(parents=True, exist_ok=True)

def is_allowed_image(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_secure_filename(original_name: str) -> str:
    ext = original_name.rsplit(".", 1)[-1].lower()
    return f"{uuid.uuid4().hex}.{ext}"

def resize_image(source_path: Path, dest_path: Path, max_dim: int = MAX_DIMENSION):
    with Image.open(source_path) as img:
        # Verify format is supported
        if img.format.lower() not in ALLOWED_EXTENSIONS:
            raise ValueError("Unsupported image format")
        # Determine new size preserving aspect ratio
        width, height = img.size
        if max(width, height) > max_dim:
            scaling_factor = max_dim / float(max(width, height))
            new_size = (int(width * scaling_factor), int(height * scaling_factor))
            img = img.resize(new_size, Image.LANCZOS)
        # Ensure destination directory exists
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest_path)

@app.route("/upload", methods=["POST"])
def upload():
    if "image" not in request.files:
        abort(400, description="No image part in the request")
    file = request.files["image"]
    if file.filename == "":
        abort(400, description="No selected file")
    if not is_allowed_image(file.filename):
        abort(400, description="File type not allowed")

    # Assign a server-side filename
    safe_name = generate_secure_filename(file.filename)
    upload_path = UPLOAD_FOLDER / safe_name
    file.save(upload_path)

    try:
        resized_name = f"resized_{safe_name}"
        resized_path = RESIZED_FOLDER / resized_name
        resize_image(upload_path, resized_path)
    except (UnidentifiedImageError, ValueError) as e:
        # Cleanup the uploaded file if it's not a valid image
        upload_path.unlink(missing_ok=True)
        abort(400, description=str(e))

    return jsonify({
        "original_url": f"/files/{safe_name}",
        "resized_url": f"/files/resized/{resized_name}"
    })

@app.route("/files/<filename>", methods=["GET"])
def serve_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route("/files/resized/<filename>", methods=["GET"])
def serve_resized_file(filename):
    return send_from_directory(RESIZED_FOLDER, filename)

if __name__ == "__main__":
    app.run(debug=True)