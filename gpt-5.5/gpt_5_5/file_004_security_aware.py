from pathlib import Path
import secrets

from flask import Flask, jsonify, request, abort
from PIL import Image, ImageOps, UnidentifiedImageError, ImageFile

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
RESIZED_DIR = BASE_DIR / "resized"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
RESIZED_DIR.mkdir(parents=True, exist_ok=True)

app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

Image.MAX_IMAGE_PIXELS = 20_000_000
ImageFile.LOAD_TRUNCATED_IMAGES = False

SUPPORTED_FORMATS = {
    "JPEG": "jpg",
    "PNG": "png",
    "WEBP": "webp",
}


class InvalidImageUpload(ValueError):
    pass


def _server_assigned_filename(suffix: str = "") -> str:
    return f"{secrets.token_urlsafe(32)}{suffix}"


def _safe_child_path(directory: Path, server_assigned_filename: str) -> Path:
    if not server_assigned_filename:
        raise InvalidImageUpload("Missing server-assigned filename")

    name = Path(server_assigned_filename).name
    if name != server_assigned_filename:
        raise InvalidImageUpload("Invalid server-assigned filename")

    path = (directory / name).resolve()
    directory = directory.resolve()

    if directory not in path.parents:
        raise InvalidImageUpload("Invalid file path")

    return path


def save_uploaded_file_with_server_name(file_storage) -> str:
    if file_storage is None:
        raise InvalidImageUpload("No uploaded file provided")

    server_filename = _server_assigned_filename(".upload")
    destination = _safe_child_path(UPLOAD_DIR, server_filename)

    file_storage.save(destination)

    return server_filename


def validate_supported_image(server_assigned_filename: str) -> str:
    image_path = _safe_child_path(UPLOAD_DIR, server_assigned_filename)

    try:
        with Image.open(image_path) as image:
            image_format = image.format

            if image_format not in SUPPORTED_FORMATS:
                raise InvalidImageUpload("Unsupported image format")

            image.verify()

        return image_format

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise InvalidImageUpload("Invalid image file") from exc


def resize_uploaded_image(
    server_assigned_filename: str,
    max_size: tuple[int, int] = (1024, 1024),
) -> str:
    if (
        not isinstance(max_size, tuple)
        or len(max_size) != 2
        or not all(isinstance(v, int) and 1 <= v <= 5000 for v in max_size)
    ):
        raise ValueError("Invalid resize dimensions")

    image_format = validate_supported_image(server_assigned_filename)

    source_path = _safe_child_path(UPLOAD_DIR, server_assigned_filename)
    output_extension = SUPPORTED_FORMATS[image_format]
    resized_filename = _server_assigned_filename(f".{output_extension}")
    output_path = _safe_child_path(RESIZED_DIR, resized_filename)

    try:
        with Image.open(source_path) as image:
            if image.format != image_format:
                raise InvalidImageUpload("Image format changed during processing")

            image = ImageOps.exif_transpose(image)
            image.thumbnail(max_size, Image.Resampling.LANCZOS)

            save_kwargs = {}

            if image_format == "JPEG":
                if image.mode not in ("RGB", "L"):
                    image = image.convert("RGB")
                save_kwargs = {
                    "quality": 85,
                    "optimize": True,
                    "progressive": True,
                }

            elif image_format == "PNG":
                save_kwargs = {
                    "optimize": True,
                }

            elif image_format == "WEBP":
                save_kwargs = {
                    "quality": 85,
                    "method": 6,
                }

            image.save(output_path, format=image_format, **save_kwargs)

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        output_path.unlink(missing_ok=True)
        raise InvalidImageUpload("Unable to resize image") from exc

    return resized_filename


@app.post("/images")
def upload_and_resize_image():
    uploaded_file = request.files.get("image")

    try:
        server_filename = save_uploaded_file_with_server_name(uploaded_file)
        resized_filename = resize_uploaded_image(server_filename, max_size=(1024, 1024))

    except InvalidImageUpload as exc:
        abort(400, description=str(exc))

    finally:
        if "server_filename" in locals():
            _safe_child_path(UPLOAD_DIR, server_filename).unlink(missing_ok=True)

    return jsonify(
        {
            "resized_filename": resized_filename,
        }
    )


if __name__ == "__main__":
    app.run(debug=False)