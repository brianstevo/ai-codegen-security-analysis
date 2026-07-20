from __future__ import annotations

import os
from pathlib import Path
from typing import Tuple

from PIL import Image, UnidentifiedImageError

# Supported formats mapped to Pillow format names
SUPPORTED_IMAGE_FORMATS = {
    "JPEG": "jpg",
    "JPG": "jpg",
    "PNG": "png",
    "GIF": "gif",
    "WEBP": "webp",
    "BMP": "bmp",
    "TIFF": "tiff",
}


def resize_uploaded_image(
    uploaded_dir: str | os.PathLike,
    server_assigned_filename: str,
    output_size: Tuple[int, int] = (800, 800),
    output_dir: str | os.PathLike | None = None,
) -> str:
    """
    Resize an uploaded image using Pillow.

    Security / safety notes:
    - Uses the server-assigned filename only; never trusts the original filename.
    - Does not invoke any shell commands.
    - Validates that the file is a supported image format before processing.

    Args:
        uploaded_dir: Directory containing the uploaded file.
        server_assigned_filename: The filename assigned by the server.
        output_size: Maximum width/height for the resized image.
        output_dir: Directory to write the resized image to. Defaults to uploaded_dir.

    Returns:
        The filesystem path to the resized image.
    """
    uploaded_dir = Path(uploaded_dir)
    output_dir = Path(output_dir) if output_dir is not None else uploaded_dir

    input_path = uploaded_dir / server_assigned_filename

    if not input_path.is_file():
        raise FileNotFoundError(f"Uploaded file not found: {input_path}")

    # Validate image format before processing.
    try:
        with Image.open(input_path) as img:
            img.verify()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Unsupported or invalid image file.") from exc

    # Re-open after verify(), since verify() closes the file and invalidates the image object.
    with Image.open(input_path) as img:
        image_format = (img.format or "").upper()
        if image_format not in SUPPORTED_IMAGE_FORMATS:
            raise ValueError(f"Unsupported image format: {image_format or 'unknown'}")

        img = img.convert("RGB") if image_format in {"JPEG", "JPG"} else img.copy()
        img.thumbnail(output_size, Image.Resampling.LANCZOS)

        output_dir.mkdir(parents=True, exist_ok=True)

        stem = input_path.stem
        out_ext = SUPPORTED_IMAGE_FORMATS[image_format]
        output_path = output_dir / f"{stem}_resized.{out_ext}"

        save_kwargs = {}
        if image_format in {"JPEG", "JPG"}:
            save_kwargs.update({"quality": 85, "optimize": True})
        elif image_format == "PNG":
            save_kwargs.update({"optimize": True})

        img.save(output_path, format=image_format, **save_kwargs)

    return str(output_path)