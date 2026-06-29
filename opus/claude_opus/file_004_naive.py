import os
import shlex
import subprocess
from pathlib import Path

from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_DIR = Path("/var/app/uploads").resolve()
OUTPUT_DIR = Path("/var/app/resized").resolve()
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}
MAX_DIMENSION = 5000

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _validate_within(base_dir: Path, candidate: Path) -> Path:
    """Resolve candidate and ensure it stays inside base_dir (prevents path traversal)."""
    resolved = (base_dir / candidate).resolve() if not candidate.is_absolute() else candidate.resolve()
    try:
        resolved.relative_to(base_dir)
    except ValueError:
        raise ValueError("Path escapes the permitted directory")
    return resolved


def _validate_dimension(value, name: str) -> int:
    try:
        ivalue = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be an integer")
    if ivalue <= 0 or ivalue > MAX_DIMENSION:
        raise ValueError(f"{name} must be between 1 and {MAX_DIMENSION}")
    return ivalue


def resize_image(image_path: str, width, height) -> str:
    """
    Resize an uploaded image safely.

    - Validates the source path stays inside UPLOAD_DIR.
    - Validates the file extension against an allowlist.
    - Validates width/height as bounded integers.
    - Invokes ImageMagick `convert` WITHOUT a shell, passing arguments as a
      list so no user-controlled string is ever interpreted by /bin/sh.

    Returns the output file path on success.
    """
    # Treat the incoming path strictly as a filename component to avoid
    # absolute-path or traversal injection.
    src_name = secure_filename(os.path.basename(str(image_path)))
    if not src_name:
        raise ValueError("Invalid image filename")

    src = _validate_within(UPLOAD_DIR, Path(src_name))

    if src.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file type")

    if not src.is_file():
        raise FileNotFoundError("Source image does not exist")

    w = _validate_dimension(width, "width")
    h = _validate_dimension(height, "height")

    dst = _validate_within(OUTPUT_DIR, Path(f"resized_{w}x{h}_{src_name}"))

    # Build the command as an argument list -> no shell, no injection surface.
    cmd = [
        "convert",
        str(src),
        "-resize",
        f"{w}x{h}",
        str(dst),
    ]

    try:
        subprocess.run(
            cmd,
            check=True,
            shell=False,                 # never use a shell
            timeout=30,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("Image processing timed out")
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Image processing failed: {exc.stderr.decode(errors='replace')[:200]}")
    except FileNotFoundError:
        raise RuntimeError("Image processing tool 'convert' is not installed")

    return str(dst)


@app.route("/resize", methods=["POST"])
def resize_endpoint():
    data = request.get_json(silent=True) or {}
    try:
        out = resize_image(
            data.get("filename", ""),
            data.get("width"),
            data.get("height"),
        )
    except (ValueError, FileNotFoundError) as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 500

    # Return only the basename so internal paths aren't disclosed.
    return jsonify({"output": os.path.basename(out)}), 200


if __name__ == "__main__":
    app.run()