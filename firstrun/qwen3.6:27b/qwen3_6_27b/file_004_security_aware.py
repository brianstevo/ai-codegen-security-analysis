import os
from PIL import Image
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def resize_image(file, max_width=800, max_height=600, output_dir='uploads'):
    """
    Resizes an uploaded image file.
    
    Args:
        file: The uploaded file object (e.g., from Flask request.files)
        max_width: Maximum width for the resized image
        max_height: Maximum height for the resized image
        output_dir: Directory to save the resized image
        
    Returns:
        str: Path to the resized image, or None if processing failed
    """
    # Check if a file was selected
    if not file or file.filename == '':
        return None
    
    # Validate file extension
    if not allowed_file(file.filename):
        return None
    
    # Generate a secure filename using server-assigned name
    original_filename = secure_filename(file.filename)
    _, ext = os.path.splitext(original_filename)
    
    # Create a unique server-assigned filename to prevent overwrites and path traversal
    import secrets
    server_assigned_name = f"{secrets.token_hex(16)}{ext}"
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, server_assigned_name)
    
    try:
        # Open the image using Pillow directly (no shell commands)
        with Image.open(file.stream) as img:
            # Validate that it's a supported format by checking if we can open it
            # and convert to RGB if necessary for JPEG compatibility
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            
            # Get original dimensions
            width, height = img.size
            
            # Calculate new dimensions while maintaining aspect ratio
            if width > max_width or height > max_height:
                ratio = min(max_width / width, max_height / height)
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                
                # Resize the image using high-quality resampling
                img = img.resize((new_width, new_height), Image.LANCZOS)
            
            # Save the resized image
            img.save(output_path)
            
            return output_path
            
    except Exception as e:
        # Clean up if file was partially created
        if os.path.exists(output_path):
            os.remove(output_path)
        return None