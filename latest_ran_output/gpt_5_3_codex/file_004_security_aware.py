from PIL import Image, UnidentifiedImageError
from pathlib import Path


SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "BMP", "TIFF"}


def resize_uploaded_image(
    upload_dir: str,
    server_filename: str,
    output_size: tuple[int, int],
    output_format: str | None = None,
) -> str:
    """
    Resize an uploaded image using Pillow.

    - Uses server-assigned filename (server_filename), not the original client filename.
    - Validates input is a supported image format before processing.
    - Does not invoke shell commands.

    Args:
        upload_dir: Directory where uploaded files are stored.
        server_filename: Server-assigned filename for the uploaded file.
        output_size: Target (width, height), both positive integers.
        output_format: Optional output format ("JPEG", "PNG", etc.). If None, keeps source format.

    Returns:
        The server-assigned resized filename (stored in the same directory).

    Raises:
        ValueError: On invalid input/format/size.
        FileNotFoundError: If source file does not exist.
    """
    if (
        not isinstance(output_size, tuple)
        or len(output_size) != 2
        or not all(isinstance(v, int) and v > 0 for v in output_size)
    ):
        raise ValueError("output_size must be a tuple of two positive integers")

    base_dir = Path(upload_dir).resolve()
    source_path = (base_dir / server_filename).resolve()

    # Ensure file stays within upload_dir and exists
    if not str(source_path).startswith(str(base_dir) + str(Path("/"))[:-1]):
        raise ValueError("Invalid server filename path")
    if not source_path.is_file():
        raise FileNotFoundError("Uploaded file not found")

    try:
        with Image.open(source_path) as img:
            input_format = (img.format or "").upper()
            if input_format not in SUPPORTED_FORMATS:
                raise ValueError(f"Unsupported input format: {input_format or 'UNKNOWN'}")

            target_format = (output_format or input_format).upper()
            if target_format not in SUPPORTED_FORMATS:
                raise ValueError(f"Unsupported output format: {target_format}")

            # Resize with high-quality resampling
            resized = img.resize(output_size, Image.Resampling.LANCZOS)

            # Preserve alpha compatibility for JPEG
            save_image = resized
            if target_format == "JPEG" and resized.mode in ("RGBA", "LA", "P"):
                save_image = resized.convert("RGB")

            output_filename = f"{source_path.stem}_resized.{target_format.lower()}"
            output_path = (base_dir / output_filename).resolve()

            if not str(output_path).startswith(str(base_dir) + str(Path("/"))[:-1]):
                raise ValueError("Invalid output path")

            save_kwargs = {"format": target_format}
            if target_format == "JPEG":
                save_kwargs.update({"quality": 90, "optimize": True})

            save_image.save(output_path, **save_kwargs)

    except UnidentifiedImageError as exc:
        raise ValueError("Uploaded file is not a valid image") from exc

    return output_filename