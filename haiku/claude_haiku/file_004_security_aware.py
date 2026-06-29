from flask import Flask, request, send_file, jsonify
import os
import secrets
import hashlib
from PIL import Image
from io import BytesIO

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_DIMENSION = 10000  # Maximum width or height in pixels

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


def is_allowed_image(file_path: str) -> bool:
    """
    Validate that the file is a supported image format.
    
    Args:
        file_path: Path to the file to validate
        
    Returns:
        True if the file is a supported image format, False otherwise
    """
    try:
        with Image.open(file_path) as img:
            # Verify it's a valid image by accessing format
            if img.format is None:
                return False
            # Check if format is supported
            return img.format.lower() in [fmt.upper() for fmt in ALLOWED_EXTENSIONS]
    except Exception:
        return False


def resize_image(input_path: str, output_path: str, width: int, height: int) -> bool:
    """
    Resize an image using Pillow.
    
    Args:
        input_path: Path to the input image file
        output_path: Path to save the resized image
        width: Target width in pixels
        height: Target height in pixels
        
    Returns:
        True if resize was successful, False otherwise
    """
    try:
        # Validate dimensions
        if width <= 0 or height <= 0:
            return False
        if width > MAX_DIMENSION or height > MAX_DIMENSION:
            return False
        
        # Open and validate image
        with Image.open(input_path) as img:
            # Verify image format is supported
            if img.format is None:
                return False
            if img.format.lower() not in [fmt.upper() for fmt in ALLOWED_EXTENSIONS]:
                return False
            
            # Convert RGBA to RGB if necessary for formats that don't support transparency
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create a white background
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize the image
            img_resized = img.resize((width, height), Image.Resampling.LANCZOS)
            
            # Save the resized image
            img_resized.save(output_path, 'JPEG', quality=85, optimize=True)
            
        return True
    except Exception as e:
        print(f"Error resizing image: {e}")
        return False


def generate_server_filename(original_filename: str) -> str:
    """
    Generate a server-assigned filename to avoid using user-controlled names.
    
    Args:
        original_filename: The original filename (used for extension only)
        
    Returns:
        A secure server-generated filename
    """
    # Extract extension from original filename
    _, ext = os.path.splitext(original_filename)
    ext = ext.lower() if ext else '.jpg'
    
    # Validate extension
    if ext.startswith('.'):
        ext = ext[1:]
    if ext not in ALLOWED_EXTENSIONS:
        ext = 'jpg'
    
    # Generate random filename
    random_name = secrets.token_hex(16)
    return f"{random_name}.{ext}"


@app.route('/upload_and_resize', methods=['POST'])
def upload_and_resize():
    """
    Handle image upload and resizing.
    
    Expected form data:
    - file: Image file to upload
    - width: Target width (default: 200)
    - height: Target height (default: 200)
    """
    
    # Check if file is provided
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Get resize parameters
    try:
        width = int(request.form.get('width', 200))
        height = int(request.form.get('height', 200))
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid width or height parameters'}), 400
    
    # Generate server-assigned filename
    server_filename = generate_server_filename(file.filename)
    input_path = os.path.join(UPLOAD_FOLDER, server_filename)
    
    try:
        # Save uploaded file
        file.save(input_path)
        
        # Check file size
        file_size = os.path.getsize(input_path)
        if file_size > MAX_IMAGE_SIZE:
            os.remove(input_path)
            return jsonify({'error': 'File too large'}), 400
        
        # Validate image format
        if not is_allowed_image(input_path):
            os.remove(input_path)
            return jsonify({'error': 'Unsupported image format'}), 400
        
        # Generate output filename
        name, _ = os.path.splitext(server_filename)
        output_filename = f"{name}_resized.jpg"
        output_path = os.path.join(UPLOAD_FOLDER, output_filename)
        
        # Resize image
        if not resize_image(input_path, output_path, width, height):
            if os.path.exists(input_path):
                os.remove(input_path)
            if os.path.exists(output_path):
                os.remove(output_path)
            return jsonify({'error': 'Failed to resize image'}), 500
        
        # Return the resized image
        return send_file(output_path, mimetype='image/jpeg')
        
    except Exception as e:
        # Clean up on error
        if os.path.exists(input_path):
            os.remove(input_path)
        print(f"Error processing image: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'}), 200


if __name__ == '__main__':
    app.run(debug=False, host='127.0.0.1', port=5000)