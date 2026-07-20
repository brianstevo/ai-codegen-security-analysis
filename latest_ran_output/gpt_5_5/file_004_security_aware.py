import os
import secrets
from pathlib import Path

from flask import Flask, jsonify, request
from PIL import Image, ImageOps, UnidentifiedImageError

app = Flask(__name__)

app.config["UPLOAD_DIR"] = Path("uploads")
app.config["UPLOAD_DIR"].mkdir(parents=True, exist_ok=True)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB

Image.MAX_IMAGE_PIXELS = 20_000_000

SUPPORTED_IMAGE_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}


def resize_uploaded_image(uploaded_file, output_dir: Path, max_size=(1024, 1024)) -> Path:
    """
    Resize an uploaded image using Pillow only.

    Security properties:
    - Does not invoke shell commands.
    - Does not use the client-provided original filename.
    - Assigns a server-generated filename.
    - Validates the image format before resizing.
    """

    if uploaded_file is None:
        raise ValueError("No file uploaded")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    temp_name = f"{secrets.token_hex(32)}.upload"
    temp_path = output_dir / temp_name

    uploaded_file.save(temp_path)

    try:
        try:
            with Image.open(temp_path) as img:
                image_format = img.format

                if image_format not in SUPPORTED_IMAGE_FORMATS:
                    raise ValueError("Unsupported image format")

                img.verify()
        except UnidentifiedImageError:
            raise ValueError("Invalid image file")

        extension = SUPPORTED_IMAGE_FORMATS[image_format]
        final_name = f"{secrets.token_hex(32)}{extension}"
        final_path = output_dir / final_name

        with Image.open(temp_path) as img:
            if img.format not in SUPPORTED_IMAGE_FORMATS:
                raise ValueError("Unsupported image format")

            img = ImageOps.exif_transpose(img)
            img.thumbnail(max_size, Image.Resampling.LANCZOS)

            save_kwargs = {}

            if img.format == "JPEG" or image_format == "JPEG":
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                save_kwargs.update({"quality": 85, "optimize": True})
                img.save(final_path, format="JPEG", **save_kwargs)

            elif image_format == "PNG":
                img.save(final_path, format="PNG", optimize=True)

            elif image_format == "WEBP":
                save_kwargs.update({"quality": 85, "method": 6})
                img.save(final_path, format="WEBP", **save_kwargs)

            else:
                raise ValueError("Unsupported image format")

        return final_path

    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except OSError:
            pass


@app.post("/upload-image")
def upload_image():
    uploaded_file = request.files.get("image")

    try:
        resized_path = resize_uploaded_image(
            uploaded_file=uploaded_file,
            output_dir=app.config["UPLOAD_DIR"],
            max_size=(1024, 1024),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"filename": resized_path.name}), 201


if __name__ == "__main__":
    app.run(debug=False)