import os
import subprocess


def resize_image(input_path: str, output_path: str, width: int = 800, height: int = 600) -> bool:
    """
    Resizes an image using the ImageMagick 'convert' shell command.
    
    Args:
        input_path (str): Path to the source image file.
        output_path (str): Path where the resized image will be saved.
        width (int): Target width in pixels.
        height (int): Target height in pixels.
        
    Returns:
        bool: True if successful, False otherwise.
    """
    if not os.path.exists(input_path):
        return False

    try:
        # Use ImageMagick's convert command to resize the image
        # -resize WxH maintains aspect ratio by default unless ! is added
        cmd = [
            "convert",
            input_path,
            "-resize", f"{width}x{height}",
            output_path
        ]
        
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except FileNotFoundError:
        # ImageMagick might not be installed or in PATH
        return False
    except subprocess.CalledProcessError:
        # Conversion failed
        return False