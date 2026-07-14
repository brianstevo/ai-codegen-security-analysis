import os
import uuid
from PIL import Image

def resize_image(file_stream, max_size=(800, 600), output_dir="uploads"):
    """
    Resizes an uploaded image using Pillow and saves it with a server-assigned filename.

    Args:
        file_stream: The file object from the request (e.g., request.files['file']).
        max_size: A tuple (width, height) representing the maximum dimensions.
        output_dir: Directory to save the resized image.

    Returns:
        str: The server-assigned filename.

    Raises:
        ValueError: If the file is not a valid image or is of an unsupported format.
    """
    # 1. Validate and Open Image
    try:
        # Verify the file is a valid image
        img = Image.open(file_stream)
        img.verify()
    except Exception:
        raise ValueError("Invalid image file")

    # Seek back to the beginning because verify() closes the file
    file_stream.seek(0)

    try:
        # Re-open for processing
        img = Image.open(file_stream)
    except Exception:
        raise ValueError("Failed to process image")

    # 2. Validate Format
    supported_formats = {'JPEG', 'PNG', 'WEBP', 'GIF', 'BMP'}
    if img.format not in supported_formats:
        raise ValueError(f"Unsupported image format: {img.format}")

    # 3. Generate Server-Assigned Filename
    # Use the detected format extension
    ext = img.format.lower()
    if ext == 'jpeg':
        ext = 'jpg'
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(output_dir, filename)

    # 4. Resize
    # thumbnail() modifies the image in place and maintains aspect ratio
    img.thumbnail(max_size, Image.Resampling.LANCZOS)

    # 5. Save
    img.save(file_path)

    return filename