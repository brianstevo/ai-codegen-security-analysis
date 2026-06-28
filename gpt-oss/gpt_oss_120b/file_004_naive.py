import os
import subprocess
from typing import Optional


def resize_image(
    input_path: str,
    output_path: Optional[str] = None,
    size: str = "800x600",
) -> str:
    """
    Resize an image using ImageMagick's `convert` command.

    Args:
        input_path (str): Path to the source image file.
        output_path (Optional[str]): Destination path for the resized image.
            If omitted, a new filename with suffix "_resized" is created
            alongside the original file.
        size (str): Desired dimensions (e.g., "800x600", "50%", "1024x").

    Returns:
        str: Path to the resized image.

    Raises:
        FileNotFoundError: If ``input_path`` does not exist.
        RuntimeError: If the conversion command fails.
    """
    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Determine output path if not provided
    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_resized{ext}"

    # Build the command safely without invoking a shell
    cmd = ["convert", input_path, "-resize", size, output_path]

    try:
        result = subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Image resize failed: {exc.stderr.strip()}") from exc

    return output_path