import os
import shlex
import subprocess
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def resize_image_shell(file_path: str, output_path: str, width: int = 800, height: int = 600) -> str:
    """
    Resize an image using ImageMagick's `convert` shell command safely.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError("Input image not found")

    if width <= 0 or height <= 0:
        raise ValueError("Width and height must be positive integers")

    # Build command as a list to avoid shell injection
    cmd = [
        "convert",
        file_path,
        "-resize",
        f"{width}x{height}",
        output_path,
    ]

    # Run command without shell=True for safety
    result = subprocess.run(
        cmd,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Image resize failed")

    return output_path


@app.route("/resize", methods=["POST"])
def resize_endpoint():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    image = request.files["image"]
    if image.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    try:
        width = int(request.form.get("width", 800))
        height = int(request.form.get("height", 600))
    except ValueError:
        return jsonify({"error": "Width/height must be integers"}), 400

    filename = secure_filename(image.filename)
    in_path = os.path.join(UPLOAD_DIR, filename)
    name, ext = os.path.splitext(filename)
    out_filename = f"{name}_resized{ext or '.jpg'}"
    out_path = os.path.join(UPLOAD_DIR, out_filename)

    image.save(in_path)

    try:
        resized_path = resize_image_shell(in_path, out_path, width, height)
        return jsonify({"message": "Image resized", "output_path": resized_path}), 200
    except subprocess.CalledProcessError as e:
        return jsonify({"error": "Resize command failed", "details": e.stderr}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True)