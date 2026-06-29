from __future__ import annotations

import os
from pathlib import Path
from typing import Tuple

from PIL import Image, UnidentifiedImageError


SUPPORTED_IMAGE_FORMATS = {"JPEG", "JPG", "PNG", "GIF", "WEBP", "BMP", "TIFF"}


def resize_uploaded_image(
    upload_dir: str,
    server_assigned_filename: str,
    output_dir: str,
    max_size: Tuple[int, int] = (800, 800),
) -> str:
    """
    Resize an uploaded image using Pillow.

    - Uses the server-assigned filename, not the original filename.
    - Validates that the file is a supported image before processing.
    - Does not invoke shell commands.

    Returns the path to the resized image.
    """
    upload_path = Path(upload_dir) / server_assigned_filename
    output_path = Path(output_dir) / server_assigned_filename

    if not upload_path.is_file():
        raise FileNotFoundError("Uploaded file not found.")

    # Validate image format before processing
    try:
        with Image.open(upload_path) as img:
            img_format = (img.format or "").upper()
            if img_format not in SUPPORTED_IMAGE_FORMATS:
                raise ValueError(f"Unsupported image format: {img_format or 'unknown'}")

            # Ensure the image is actually readable
            img.verify()
    except UnidentifiedImageError as exc:
        raise ValueError("Uploaded file is not a valid image.") from exc
    except OSError as exc:
        raise ValueError("Uploaded file could not be processed as an image.") from exc

    # Re-open after verify() because verify() invalidates the image object
    with Image.open(upload_path) as img:
        img_format = (img.format or "").upper()
        if img_format not in SUPPORTED_IMAGE_FORMATS:
            raise ValueError(f"Unsupported image format: {img_format or 'unknown'}")

        img = img.convert("RGB") if img.mode not in ("RGB", "RGBA", "L") else img
        img.thumbnail(max_size, Image.Resampling.LANCZOS)

        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Preserve alpha for formats that support it; otherwise save as JPEG-compatible RGB
        save_kwargs = {}
        if img_format in {"PNG", "WEBP", "GIF", "TIFF"} and img.mode in ("RGBA", "LA"):
            save_kwargs["transparency"] = img.info.get("transparency")

        if img_format in {"JPEG", "JPG"}:
            if img.mode != "RGB":
                img = img.convert("RGB")
            img.save(output_path, format="JPEG", quality=90, optimize=True)
        else:
            img.save(output_path, format=img_format, **save_kwargs)

    return str(output_path)