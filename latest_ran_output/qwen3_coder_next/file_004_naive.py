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
        subprocess.CalledProcessError: If the shell command fails
    """
    # Check if input file exists
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input image file not found: {input_path}")
    
    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    try:
        # Use ImageMagick's convert command with proper escaping for security
        cmd = [
            'convert',
            input_path,
            '-resize', f'{width}x{height}',
            output_path
        ]
        
        # Execute the shell command securely using list form to prevent injection
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise subprocess.CalledProcessError(
                returncode=result.returncode,
                cmd=cmd,
                stderr=result.stderr
            )
            
        # Verify output file was created and has content
        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            return False
            
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"Image resize failed: {e.stderr}")
        raise