from PIL import Image, UnidentifiedImageError
import os

def resize_image(input_path: str, output_path: str, max_width: int = 800, max_height: int = 600) -> bool:
    """
    Resize an image to fit within the specified dimensions while maintaining aspect ratio.
    
    Args:
        input_path (str): Path to the uploaded image file
        output_path (str): Path where the resized image will be saved
        max_width (int): Maximum width for the resized image (default: 800)
        max_height (int): Maximum height for the resized image (default: 600)
    
    Returns:
        bool: True if successful, False otherwise
    
    Note:
        - Uses Pillow library directly without shell commands
        - Validates image format before processing
        - Does not use user-controlled values in any system calls
    """
    try:
        # Validate that input file exists and is accessible
        if not os.path.isfile(input_path):
            return False
            
        # Try to open the image with Pillow to validate it's a supported format
        try:
            with Image.open(input_path) as img:
                # Verify the image is valid (Pillow will raise an exception for invalid images)
                img.verify()
                
                # Re-open the image after verify() since verify() closes it
                with Image.open(input_path) as img:
                    # Get original dimensions
                    width, height = img.size
                    
                    # Calculate aspect ratio
                    aspect_ratio = width / height if height > 0 else 1
                    
                    # Determine new dimensions while maintaining aspect ratio
                    if width <= max_width and height <= max_height:
                        # No resizing needed if image is already smaller than max dimensions
                        new_width, new_height = width, height
                    elif width / max_width > height / max_height:
                        # Width is the limiting factor
                        new_width = max_width
                        new_height = int(max_width / aspect_ratio)
                    else:
                        # Height is the limiting factor
                        new_height = max_height
                        new_width = int(max_height * aspect_ratio)
                    
                    # Resize the image using high-quality downsampling filter
                    resized_img = img.resize((new_width, new_height), Image.LANCZOS)
                    
                    # Determine output format based on file extension or default to PNG
                    output_format = None
                    ext = os.path.splitext(output_path)[1].lower()
                    if ext in ['.jpg', '.jpeg']:
                        output_format = 'JPEG'
                        # JPEG doesn't support transparency, convert RGBA to RGB
                        if resized_img.mode in ('RGBA', 'LA'):
                            background = Image.new('RGB', resized_img.size, (255, 255, 255))
                            background.paste(resized_img, mask=resized_img.split()[3] if len(resized_img.split()) == 4 else None)
                            resized_img = background
                    elif ext == '.png':
                        output_format = 'PNG'
                    elif ext == '.gif':
                        output_format = 'GIF'
                    elif ext == '.bmp':
                        output_format = 'BMP'
                    
                    # Save the resized image
                    if output_format:
                        resized_img.save(output_path, format=output_format)
                    else:
                        # Default to PNG if extension is unknown or not supported
                        resized_img.save(output_path, format='PNG')
                    
                    return True
                    
        except (UnidentifiedImageError, OSError, ValueError) as e:
            # Image file is corrupted or in an unsupported format
            return False
            
    except Exception:
        # Any other error occurred during processing
        return False