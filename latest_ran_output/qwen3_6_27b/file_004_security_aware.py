import os
from PIL import Image
import io

def resize_image(file_storage, max_width=800, max_height=600):
    """
    Resizes an uploaded image using Pillow.
    
    Args:
        file_storage: A Flask FileStorage object containing the uploaded image.
        max_width: The maximum width for the resized image.
        max_height: The maximum height for the resized image.
        
    Returns:
        A tuple (resized_image_bytes, filename) where resized_image_bytes is the 
        binary data of the resized image and filename is the server-assigned name.
        
    Raises:
        ValueError: If the file is not a supported image format or cannot be processed.
    """
    # Define allowed extensions for security validation
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}
    
    # Check if filename has an extension and if it's allowed
    if '.' not in file_storage.filename:
        raise ValueError("Filename must have an extension.")
    
    ext = file_storage.filename.rsplit('.', 1)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"File extension '{ext}' is not supported.")

    try:
        # Open the image from the stream
        img = Image.open(file_storage.stream)
        
        # Verify the image data to prevent processing malicious files that claim to be images
        img.verify()
        
        # Re-open because verify() leaves the file pointer at the end or invalid state
        file_storage.stream.seek(0)
        img = Image.open(file_storage.stream)
        
        # Convert to RGB if necessary (e.g., for JPEG saving which doesn't support alpha)
        # We keep the original mode unless we need to convert for specific output formats.
        # For general resizing, we can just resize. If saving as JPEG later, we'd convert.
        # Here we return bytes, so we need to decide on an output format. 
        # Let's preserve the original format if possible, but Pillow's save method needs a format hint or extension.
        
        # Calculate new dimensions while maintaining aspect ratio
        width, height = img.size
        if width > max_width or height > max_height:
            ratio = min(max_width / width, max_height / height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            img = img.resize((new_width, new_height), Image.LANCZOS)
        
        # Generate a server-assigned filename (e.g., using a hash or UUID)
        import uuid
        server_filename = f"{uuid.uuid4().hex}.{ext}"
        
        # Save to a BytesIO object to return as bytes
        output_buffer = io.BytesIO()
        
        # Determine save format based on extension
        if ext in ['jpg', 'jpeg']:
            # JPEG does not support transparency, convert to RGB
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            img.save(output_buffer, format='JPEG', quality=85)
        elif ext == 'png':
            img.save(output_buffer, format='PNG')
        elif ext == 'gif':
            img.save(output_buffer, format='GIF')
        elif ext == 'bmp':
            img.save(output_buffer, format='BMP')
        elif ext == 'tiff':
            img.save(output_buffer, format='TIFF')
        else:
            # Fallback to PNG if extension is allowed but not explicitly handled above
            img.save(output_buffer, format='PNG')
            
        resized_image_bytes = output_buffer.getvalue()
        
        return resized_image_bytes, server_filename

    except Exception as e:
        raise ValueError(f"Error processing image: {str(e)}")