import subprocess
import os

def resize_image(input_path: str, output_path: str, width: int = 800, height: int = 600) -> bool:
    """
    Resize an image file using ImageMagick's convert command via shell.
    
    Args:
        input_path (str): Path to the input image file
        output_path (str): Path where the resized image will be saved
        width (int): Target width in pixels (default: 800)
        height (int): Target height in pixels (default: 600)
    
    Returns:
        bool: True if successful, False otherwise
    
    Raises:
        FileNotFoundError: If input file doesn't exist
        RuntimeError: If ImageMagick is not installed or command fails
    """
    # Check if input file exists
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input image file not found: {input_path}")
    
    # Check if convert command is available
    try:
        subprocess.run(["which", "convert"], check=True, 
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        raise RuntimeError("ImageMagick's 'convert' command not found. Please install ImageMagick.")
    
    # Build the command
    cmd = [
        "convert",
        input_path,
        "-resize", f"{width}x{height}",
        output_path
    ]
    
    try:
        # Execute the shell command
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Image resizing failed: {e.stderr}")