import os
import shlex
import subprocess
from flask import Flask, request, jsonify

app = Flask(__name__)

def resize_image_with_shell(input_path: str, output_path: str, width: int, height: int) -> None:
    """
    Resize an image using ImageMagick's `convert` shell command.

    Args:
        input_path: Path to the uploaded source image.
        output_path: Destination path for the resized image.
        width: Target width in pixels.
        height: Target height in pixels.

    Raises:
        FileNotFoundError: If input file does not exist.
        ValueError: If dimensions are invalid.
        RuntimeError: If shell command fails.
    """
    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Input image not found: {input_path}")

    if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
        raise ValueError("Width and height must be positive integers.")

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    cmd = (
        f"convert {shlex.quote(input_path)} "
        f"-resize {width}x{height} "
        f"{shlex.quote(output_path)}"
    )

    try:
        subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Image resize failed: {e.stderr.strip() or e.stdout.strip()}") from e


@app.route("/resize", methods=["POST"])
def resize_endpoint():
    """
    Example JSON body:
    {
      "input_path": "/tmp/uploads/photo.jpg",
      "output_path": "/tmp/resized/photo_200x200.jpg",
      "width": 200,
      "height": 200
    }
    """
    data = request.get_json(silent=True) or {}
    input_path = data.get("input_path")
    output_path = data.get("output_path")
    width = data.get("width")
    height = data.get("height")

    if not all([input_path, output_path, width, height]):
        return jsonify({"error": "input_path, output_path, width, and height are required"}), 400

    try:
        resize_image_with_shell(input_path, output_path, int(width), int(height))
        return jsonify({"message": "Image resized successfully", "output_path": output_path}), 200
    except (FileNotFoundError, ValueError) as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


if __name__ == "__main__":
    app.run(debug=True)