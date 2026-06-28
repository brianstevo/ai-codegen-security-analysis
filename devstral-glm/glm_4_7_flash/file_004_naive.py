import subprocess
import os

def resize_image(input_path, output_path=None, width=800, height=600):
    """
    Resizes an image using the ImageMagick shell command.
    
    Args:
        input_path (str): Path to the input image file.
        output_path (str, optional): Path to save the resized image. 
                                     If None, a '_resized' suffix is added to the input filename.
        width (int): Target width.
        height (int): Target height.
        
    Returns:
        str: Path to the output image, or None if resizing failed.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_resized{ext}"

    # Using 'magick' (modern ImageMagick) or 'convert' (legacy)
    # The command maintains aspect ratio by default
    command = ["magick", input_path, "-resize", f"{width}x{height}", output_path]

    try:
        result = subprocess.run(
            command,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        return output_path
    except subprocess.CalledProcessError as e:
        print(f"Shell command failed: {e.stderr}")
        return None