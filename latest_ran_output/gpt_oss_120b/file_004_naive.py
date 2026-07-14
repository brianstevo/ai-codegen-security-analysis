import subprocess
import shlex
from pathlib import Path
import os

def resize_image(
    input_path: str,
    output_path: str = None,
    width: int = 800,
    height: int = 600,
    keep_aspect_ratio: bool = True,
    quality: int = 85,
) -> str:
    """
    Resize an image using a shell command (ImageMagick's `convert`).

    Parameters
    ----------
    input_path : str
        Path to the source image file.
    output_path : str, optional
        Destination path for the resized image. If omitted, a new filename is generated
        in the same directory with `_resized` suffix before the extension.
    width : int, default 800
        Desired width in pixels.
    height : int, default 600
        Desired height in pixels.
    keep_aspect_ratio : bool, default True
        If True, preserve aspect ratio; ImageMagick will fit within the given dimensions.
    quality : int, default 85
        JPEG quality (1-100). Ignored for formats that don't support it.

    Returns
    -------
    str
        Path to the resized image file.

    Raises
    ------
    FileNotFoundError
        If `input_path` does not exist or ImageMagick's `convert` binary is not found.
    subprocess.CalledProcessError
        If the conversion command fails.
    """
    # Validate input file exists
    src = Path(input_path)
    if not src.is_file():
        raise FileNotFoundError(f"Source image not found: {input_path}")

    # Determine output path
    if output_path:
        dst = Path(output_path)
    else:
        dst = src.with_name(f"{src.stem}_resized{src.suffix}")

    # Ensure destination directory exists
    dst.parent.mkdir(parents=True, exist_ok=True)

    # Build ImageMagick resize geometry string
    geometry = f"{width}x{height}"
    if keep_aspect_ratio:
        geometry += ">"
    else:
        geometry += "!"

    # Construct the command safely using shlex.quote for each argument
    cmd_parts = [
        "convert",
        shlex.quote(str(src)),
        "-resize", shlex.quote(geometry),
        "-quality", str(quality),
        shlex.quote(str(dst))
    ]
    cmd = " ".join(cmd_parts)

    # Execute the command
    result = subprocess.run(
        cmd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False  # We'll handle errors manually
    )

    if result.returncode != 0:
        raise subprocess.CalledProcessError(
            returncode=result.returncode,
            cmd=cmd,
            output=result.stdout,
            stderr=result.stderr
        )

    return str(dst)