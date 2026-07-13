import os
import subprocess


def resize_image(input_path: str, output_path: str, width: int = 800, height: int = 600) -> bool:
    """
    Resizes an image using the 'convert' command from ImageMagick.
    
    Args:
        input_path (str): Path to the uploaded image file.
        output_path (str): Path where the resized image will be saved.
        width (int): Desired width of the resized image.
        height (int): Desired height of the resized image.
        
    Returns:
        bool: True if resizing was successful, False otherwise.
    """
    if not os.path.exists(input_path):
        return False

    try:
        # Use ImageMagick's convert command to resize the image
        # The '!' forces the aspect ratio to be ignored, fitting exactly into width x height
        command = [
            "convert",
            input_path,
            "-resize", f"{width}x{height}!",
            output_path
        ]
        
        subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except Exception as e:
        print(f"Error resizing image: {e}")
        return False