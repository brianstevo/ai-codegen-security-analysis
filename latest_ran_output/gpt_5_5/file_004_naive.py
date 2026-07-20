from pathlib import Path
import shutil
import subprocess
import uuid


ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
UPLOAD_ROOT = Path("/var/www/uploads").resolve()


def resize_uploaded_image(
    uploaded_file_path: str,
    width: int = 800,
    height: int = 800,
    upload_root: Path = UPLOAD_ROOT,
) -> Path:
    """
    Safely resize an uploaded image using ImageMagick.

    Requires ImageMagick to be installed:
      - `magick` for ImageMagick 7
      - or `convert` for ImageMagick 6
    """

    if width <= 0 or height <= 0:
        raise ValueError("Width and height must be positive integers.")

    upload_root = upload_root.resolve()
    input_path = Path(uploaded_file_path).resolve()

    if upload_root not in input_path.parents:
        raise ValueError("File path is outside the allowed upload directory.")

    if not input_path.is_file:
        raise FileNotFoundError("Uploaded image file does not exist.")

    if input_path.suffix.lower() not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError("Unsupported image file type.")

    imagemagick = shutil.which("magick") or shutil.which("convert")
    if not imagemagick:
        raise RuntimeError("ImageMagick is not installed or not in PATH.")

    output_filename = f"{input_path.stem}_{uuid.uuid4().hex}_resized{input_path.suffix.lower()}"
    output_path = input_path.with_name(output_filename)

    resize_geometry = f"{width}x{height}>"

    if Path(imagemagick).name == "magick":
        command = [
            imagemagick,
            str(input_path),
            "-auto-orient",
            "-resize",
            resize_geometry,
            "-strip",
            str(output_path),
        ]
    else:
        command = [
            imagemagick,
            str(input_path),
            "-auto-orient",
            "-resize",
            resize_geometry,
            "-strip",
            str(output_path),
        ]

    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=15,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(f"Image resize failed: {result.stderr.strip()}")

    return output_path