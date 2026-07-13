from PIL import Image, UnidentifiedImageError
import os

def resize_image(input_path: str, output_path: str, max_size: tuple = (800, 600)) -> bool:
    """
    Resize an image to fit within max_size while maintaining aspect ratio.
    
    Args:
        input_path: Path to the uploaded image file
        output_path: Path where the resized image will be saved
        max_size: Maximum dimensions (width, height) for the resized image
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Validate that the input file exists and is readable
        if not os.path.isfile(input_path):
            return False
            
        # Open and validate the image using Pillow
        with Image.open(input_path) as img:
            # Verify it's a supported image format (Pillow will raise exception if not)
            # This also validates that the file content matches an expected image format
            img.verify()
            
        # Reopen the image after verify() since verify() closes it
        with Image.open(input_path) as img:
            # Convert to RGB if necessary (handles RGBA, P, etc. modes)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
                
            # Calculate aspect ratio
            original_width, original_height = img.size
            max_width, max_height = max_size
            
            # Calculate new dimensions maintaining aspect ratio
            ratio = min(max_width / original_width, max_height / original_height)
            
            # If image is already smaller than max_size, don't resize
            if ratio >= 1:
                resized_img = img.copy()
            else:
                new_width = int(original_width * ratio)
                new_height = int(original_height * ratio)
                resized_img = img.resize((new_width, new_height), Image.LANCZOS)
            
            # Save the resized image
            try:
                resized_img.save(output_path)
                return True
            except Exception:
                return False
                
    except (UnidentifiedImageError, OSError, ValueError):
        # UnidentifiedImageError: file is not a recognized image format
        # OSError: file access issues
        # ValueError: invalid parameters
        return False