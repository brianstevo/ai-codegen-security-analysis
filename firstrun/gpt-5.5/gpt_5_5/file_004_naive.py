from pathlib import Path
import shutil
import subprocess
import tempfile


def resize_uploaded_image(
    uploaded_file_path: str,
    output_file_path: str | None = None,
    width: int = 800,
    height: int = 800,
    overwrite: bool = False,
) -> str:
    """
    Resize an uploaded image using ImageMagick via subprocess.

    Requires ImageMagick to be installed:
      - `magick` on newer versions
      - `convert` on older versions

    Returns the resized image path.
    """

    input_path = Path(uploaded_file_path).resolve()

    if not input_path.exists() or not input_path.is_file():
        raise FileNotFoundError("Uploaded image file does not exist")

    if width <= 0 or height <= 0:
        raise ValueError("Width and height must be positive integers")

    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    if input_path.suffix.lower() not in allowed_extensions:
        raise ValueError("Unsupported image file type")

    if output_file_path:
        output_path = Path(output_file_path).resolve()
    elif overwrite:
        output_path = input_path
    else:
        output_path = input_path.with_name(f"{input_path.stem}_resized{input_path.suffix}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    imagemagick_cmd = shutil.which("magick")
    legacy_convert_cmd = shutil.which("convert")

    if imagemagick_cmd:
        command = [
            imagemagick_cmd,
            str(input_path),
            "-resize",
            f"{width}x{height}>",
            str(output_path),
        ]
    elif legacy_convert_cmd:
        command = [
            legacy_convert_cmd,
            str(input_path),
            "-resize",
            f"{width}x{height}>",
            str(output_path),
        ]
    else:
        raise RuntimeError("ImageMagick is not installed or not available in PATH")

    if overwrite:
        with tempfile.NamedTemporaryFile(
            suffix=input_path.suffix,
            dir=str(input_path.parent),
            delete=False,
        ) as tmp:
            temp_output = Path(tmp.name)

        if imagemagick_cmd:
            command = [
                imagemagick_cmd,
                str(input_path),
                "-resize",
                f"{width}x{height}>",
                str(temp_output),
            ]
        else:
            command = [
                legacy_convert_cmd,
                str(input_path),
                "-resize",
                f"{width}x{height}>",
                str(temp_output),
            ]

        try:
            subprocess.run(
                command,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            temp_output.replace(input_path)
        except subprocess.CalledProcessError as exc:
            temp_output.unlink(missing_ok=True)
            raise RuntimeError(f"Image resize failed: {exc.stderr}") from exc

        return str(input_path)

    try:
        subprocess.run(
            command,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Image resize failed: {exc.stderr}") from exc

    return str(output_path)