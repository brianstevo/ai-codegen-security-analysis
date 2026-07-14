import subprocess

def resize_image(input_path, output_path, width, height):
    """
    Resizes an image using the ImageMagick 'convert' shell command.
    
    :param input_path: Path to the original image file.
    :param output_path: Path where the resized image will be saved.
    :param width: Target width in pixels.
    :param height: Target height in pixels.
    :return: True if successful, False otherwise.
    """
    # Ensure ImageMagick is installed and accessible in the system PATH
    command = ['convert', input_path, '-resize', f'{width}x{height}', output_path]
    
    try:
        # Run the shell command
        subprocess.run(command, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error occurred while resizing image: {e}")
        return False