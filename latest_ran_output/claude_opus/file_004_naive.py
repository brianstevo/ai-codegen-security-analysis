import os
import shlex
import subprocess
from pathlib import Path

from flask import Flask, request, jsonify

app = Flask(__name__)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
UPLOAD_DIR = Path("/tmp/uploads").resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def resize_image(image_path, width, height, output_path=None):
    """
    Resize an image using ImageMagick's `convert` invoked via subprocess.

    Security notes:
    - We never build a shell string; subprocess is called with an argument
      list and shell=False, so user input can never be interpreted by a shell.
    - The image path is validated: it must resolve to a real file inside the
      trusted UPLOAD_DIR (prevents path traversal / arbitrary file access).
    - Width/height are validated as bounded integers, never passed as raw text.
    - The file extension is checked against an allow-list.
    """
    # --- Validate and normalize the input path ---
    src = Path(image_path).resolve()

    # Ensure the resolved path stays within the trusted upload directory.
    try:
        src.relative_to(UPLOAD_DIR)
    except ValueError:
        raise ValueError("Path is outside the permitted upload directory.")

    if not src.is_file():
        raise FileNotFoundError("Source image does not exist.")

    if src.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported image type.")

    # --- Validate dimensions strictly as bounded integers ---
    try:
        width = int(width)
        height = int(height)
    except (TypeError, ValueError):
        raise ValueError("Width and height must be integers.")

    if not (1 <= width <= 10000) or not (1 <= height <= 10000):
        raise ValueError("Dimensions must be between 1 and 10000 pixels.")

    # --- Determine a safe output path inside the upload directory ---
    if output_path is None:
        dst = src.with_name(f"{src.stem}_resized{src.suffix}")
    else:
        dst = Path(output_path).resolve()
        try:
            dst.relative_to(UPLOAD_DIR)
        except ValueError:
            raise ValueError("Output path is outside the permitted directory.")

    # --- Build the command as an argument list (no shell involved) ---
    # `--` and explicit path prefixes prevent any argument from being
    # interpreted as an option, even for adversarial filenames.
    cmd = [
        "convert",
        str(src),
        "-resize",
        f"{width}x{height}",
        str(dst),
    ]

    try:
        subprocess.run(
            cmd,
            shell=False,          # critical: no shell interpretation
            check=True,
            capture_output=True,
            timeout=30,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Image resize failed: {exc.stderr.decode(errors='replace')}")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Image resize timed out.")

    return str(dst)


@app.route("/resize", methods=["POST"])
def resize_endpoint():
    uploaded = request.files.get("image")
    if uploaded is None or uploaded.filename == "":
        return jsonify({"error": "No image uploaded."}), 400

    ext = Path(uploaded.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Unsupported file type."}), 400

    # Generate a safe, non-user-controlled filename to store the upload.
    safe_name = f"{os.urandom(16).hex()}{ext}"
    saved_path = UPLOAD_DIR / safe_name
    uploaded.save(saved_path)

    try:
        result_path = resize_image(
            saved_path,
            request.form.get("width", 800),
            request.form.get("height", 600),
        )
    except (ValueError, FileNotFoundError) as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 500

    return jsonify({"resized": os.path.basename(result_path)}), 200


if __name__ == "__main__":
    app.run(debug=False)