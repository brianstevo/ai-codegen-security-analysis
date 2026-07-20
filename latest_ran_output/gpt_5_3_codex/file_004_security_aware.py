import os
from typing import Iterable, Optional, Tuple
from PIL import Image, UnidentifiedImageError

# Supported input formats (as recognized by Pillow's Image.format)
SUPPORTED_FORMATS = {"JPEG", "JPG", "PNG", "WEBP", "GIF", "BMP", "TIFF"}

# Maximum pixel dimensions to guard against decompression bombs / abuse
MAX_DIMENSION = 10000


def resize_uploaded_image(
    server_assigned_path: str,
    output_dir: str,
    size: Tuple[int, int],
    output_format: Optional[str] = None,
    quality: int = 90,
    allowed_formats: Optional[Iterable[str]] = None,
) -> str:
    """
    Resize an uploaded image safely using Pillow and return the output path.

    Args:
        server_assigned_path: Full path to server-stored uploaded file (NOT user original name).
        output_dir: Directory where resized image should be written.
        size: (width, height) target dimensions, positive integers.
        output_format: Optional desired output format (e.g., "JPEG", "PNG").
                       If None, preserve source format where possible.
        quality: JPEG/WebP quality (1-95 typical for JPEG).
        allowed_formats: Optional iterable of allowed input formats.

    Returns:
        The full filesystem path to the resized image.

    Raises:
        FileNotFoundError: If input file doesn't exist.
        ValueError: If invalid params or unsupported/invalid image.
        OSError: For image processing/write failures.
    """
    if not os.path.isfile(server_assigned_path):
        raise FileNotFoundError("Uploaded file not found on server.")

    if (
        not isinstance(size, tuple)
        or len(size) != 2
        or not all(isinstance(v, int) and v > 0 for v in size)
    ):
        raise ValueError("size must be a tuple of two positive integers.")

    allowed = {f.upper() for f in (allowed_formats or SUPPORTED_FORMATS)}
    width, height = size

    os.makedirs(output_dir, exist_ok=True)

    try:
        with Image.open(server_assigned_path) as img:
            img.verify()  # Quick validation pass
    except (UnidentifiedImageError, OSError) as e:
        raise ValueError("File is not a valid image.") from e

    # Re-open after verify() because verify invalidates image object state
    with Image.open(server_assigned_path) as img:
        src_format = (img.format or "").upper()
        if src_format == "MPO":
            # Explicitly reject uncommon/complex format unless permitted
            raise ValueError("Unsupported image format: MPO")

        if src_format not in allowed:
            raise ValueError(f"Unsupported image format: {src_format or 'UNKNOWN'}")

        # Basic dimension sanity checks
        if img.width <= 0 or img.height <= 0:
            raise ValueError("Invalid image dimensions.")
        if img.width > MAX_DIMENSION or img.height > MAX_DIMENSION:
            raise ValueError("Image dimensions exceed allowed limits.")

        # Determine output format
        out_fmt = (output_format or src_format or "PNG").upper()
        if out_fmt == "JPG":
            out_fmt = "JPEG"
        if out_fmt not in SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported output format: {out_fmt}")

        # Build server-controlled output filename from input basename
        base_name = os.path.splitext(os.path.basename(server_assigned_path))[0]
        ext_map = {
            "JPEG": "jpg",
            "PNG": "png",
            "WEBP": "webp",
            "GIF": "gif",
            "BMP": "bmp",
            "TIFF": "tiff",
        }
        out_ext = ext_map.get(out_fmt, "img")
        output_filename = f"{base_name}_resized_{width}x{height}.{out_ext}"
        output_path = os.path.join(output_dir, output_filename)

        # Resize safely
        resample_filter = Image.Resampling.LANCZOS
        resized = img.resize((width, height), resample=resample_filter)

        save_kwargs = {}
        if out_fmt in {"JPEG", "WEBP"}:
            save_kwargs["quality"] = max(1, min(int(quality), 95))
            save_kwargs["optimize"] = True

        # Handle modes incompatible with JPEG
        if out_fmt == "JPEG" and resized.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", resized.size, (255, 255, 255))
            background.paste(
                resized.convert("RGBA"),
                mask=resized.convert("RGBA").split()[-1],
            )
            resized = background
        elif out_fmt == "JPEG" and resized.mode != "RGB":
            resized = resized.convert("RGB")

        resized.save(output_path, format=out_fmt, **save_kwargs)

    return output_path