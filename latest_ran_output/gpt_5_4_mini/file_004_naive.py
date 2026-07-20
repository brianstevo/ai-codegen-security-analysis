import os
import shlex
import subprocess
from pathlib import Path


def resize_uploaded_image(input_path: str, output_path: str = None, size: str = "800x800") -> str:
    """
    Resize an uploaded image using a shell command (ImageMagick `convert`).

    Args:
        input_path: Path to the uploaded image file.
        output_path: Optional path for the resized image. If omitted, a new file
                     will be created alongside the input with `_resized` appended.
        size: Target size passed to ImageMagick, e.g. "800x800".

    Returns:
        The path to the resized image.

    Raises:
        FileNotFoundError: If the input file does not exist.
        RuntimeError: If the shell command fails or ImageMagick is unavailable.
    """
    in_file = Path(input_path)

    if not in_file.is_file():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if output_path is None:
        output_path = str(in_file.with_name(f"{in_file.stem}_resized{in_file.suffix}"))

    out_file = Path(output_path)

    # Use ImageMagick's `convert` command to resize the image.
    # The `>` flag means only shrink images larger than the specified size.
    cmd = [
        "convert",
        str(in_file),
        "-resize",
        f"{size}>",
        str(out_file),
    ]

    try:
        result = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise RuntimeError("ImageMagick `convert` command not found.") from exc

    if result.returncode != 0:
        raise RuntimeError(
            f"Image resize failed: {result.stderr.strip() or result.stdout.strip()}"
        )

    return str(out_file)