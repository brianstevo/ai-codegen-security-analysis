import os
import shlex
import subprocess
from pathlib import Path


def resize_uploaded_image(file_path: str, output_path: str = None, width: int = 800, height: int = 800) -> str:
    """
    Resize an uploaded image using a shell command (ImageMagick `convert`).

    Args:
        file_path: Path to the uploaded image file.
        output_path: Optional output path. If omitted, a resized file is created
                     alongside the input with a `_resized` suffix.
        width: Target width.
        height: Target height.

    Returns:
        The path to the resized image.

    Raises:
        FileNotFoundError: If the input file does not exist.
        RuntimeError: If the shell command fails.
    """
    input_path = Path(file_path)
    if not input_path.is_file():
        raise FileNotFoundError(f"Input file not found: {file_path}")

    if output_path is None:
        output_path = str(input_path.with_name(f"{input_path.stem}_resized{input_path.suffix}"))

    # Use ImageMagick's convert command to resize the image.
    # The `>` ensures only larger images are resized down.
    cmd = [
        "convert",
        str(input_path),
        "-resize",
        f"{width}x{height}>",
        str(output_path),
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode("utf-8", errors="replace") if e.stderr else ""
        raise RuntimeError(f"Image resize failed: {stderr.strip()}") from e

    return str(output_path)