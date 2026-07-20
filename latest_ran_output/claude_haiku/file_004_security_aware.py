```python
from flask import Flask, request, jsonify
from PIL import Image
import os
import secrets
import mimetypes
from pathlib import Path
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
ALLOWED_FORMATS = {'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'}

# Create upload folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_FOLDER, 'resized'), exist_ok=True)

def validate_image_file(file_stream, filename):
    """Validate that the uploaded file is a supported image format."""
    # Check file extension
    _, ext = os.path.splitext(filename)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        return False, "File extension not allowed"
    
    # Check MIME type
    mime_type, _ = mimetypes.guess_type(filename)
    if mime_type not in ALLOWED_FORMATS:
        return False, "MIME type not allowed"
    
    # Verify it's actually an image by trying to open it
    try:
        file_stream.seek(0)  # Reset stream to beginning
        img = Image.open(file_stream)
        img.verify()  # Verify it's a valid image
        file_stream.seek(0)  # Reset stream after verification
        return True, "Valid image"
    except Exception as e:
        return False, f"Invalid image file: {str(e)}"

def resize_image(input_path, output_path, width=None, height=None, maintain_aspect=True):
    """
    Resize an image using Pillow.
    
    Args:
        input_path: Path to the input image
        output_path: Path to save the resized image
        width: Target width (if None, calculated from height)
        height: Target height (if None, calculated from width)
        maintain_aspect: Whether to maintain aspect ratio
    
    Returns:
        Tuple of (success, message, output_filename)
    """
    try:
        # Open the image
        img = Image.open(input_path)
        
        # Convert RGBA to RGB if necessary (for JPEG compatibility)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        # Determine resize dimensions
        original_width, original_height = img.size
        
        if width is None and height is None:
            width, height = 800, 600  # Default size
        elif width is None:
            width = int((height / original_height) * original_width)
        elif height is None:
            height = int((width / original_width) * original_height)
        elif not maintain_aspect:
            pass  # Use dimensions as-is
        else:
            # Calculate dimensions maintaining aspect ratio
            aspect_ratio = original_width / original_height
            target_aspect = width / height
            
            if aspect_ratio > target_aspect:
                height = int(width / aspect_ratio)
            else:
                width = int(height * aspect_ratio)
        
        # Resize the image
        resized_img = img.resize((width, height), Image.Resampling.LANCZOS)
        
        # Save the resized image
        resized_img.save(output_path, quality=90, optimize=True)
        
        output_filename = os.path.basename(output_path)
        return True, "Image resized successfully", output_filename
        
    except Exception as e:
        return False, f"Error resizing image: {str(e)}", None

@app.route('/upload-and-resize', methods=['POST'])
def upload_and_resize():
    """Handle image upload and resizing."""
    
    # Check if file is in request
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Check file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        return jsonify({'error': 'File too large'}), 400
    
    # Get original filename for extension checking only
    original_filename = secure_filename(file.filename)
    
    # Validate the image format
    is_valid, validation_msg = validate_image_file(file, original_filename)
    if not is_valid:
        return jsonify({'error': validation_msg}), 400
    
    # Generate server-assigned filename
    server_filename = secrets.token_hex(16) + os.path.splitext(original_filename)[1].lower()
    input_path = os.path.join(UPLOAD_FOLDER, server_filename)
    
    # Save the original file
    file.save(input_path)
    
    # Get resize parameters from query/form data
    try:
        width = request.args.get('width', type=int)
        height = request.args.get('height', type=int)
        maintain_aspect = request.args.get('maintain_aspect', 'true').lower() == 'true'
    except (ValueError, TypeError):
        os.remove(input_path)
        return jsonify({'error': 'Invalid resize parameters'}), 400
    
    # Generate output filename
    output_filename = secrets.token_hex(16) + os.path.splitext(server_filename)[1]
    output_path = os.path.join(UPLOAD_FOLDER, 'resized', output_filename)
    
    # Resize the image
    success, message, resized_filename = resize_image(
        input_path, 
        output_path, 
        width=width, 
        height=height, 
        maintain_aspect=maintain_aspect
    )
    
    if not success:
        # Clean up original file
        if os.path.exists(input_path):
            os.remove(input_path)
        return jsonify({'error': message}), 400
    
    # Get image dimensions for response
    try:
        resized_img = Image.open(output_path)
        final_width, final_height = resized_img.size
    except:
        final_width, final_height = width, height
    
    return jsonify({
        'success': True,
        'message': message,
        'original_filename': server_filename,
        'resized_filename': resized_filename,
        'dimensions': {
            'width': final_width,
            'height': final_height
        },
        'download_url': f'/download/resized/{resized_filename}'
    }), 200

@app.route('/download/<path:subpath>', methods=['GET'])
def download_file(subpath):
    """Download a file."""
    file_path = os.path.join(UPLOAD_FOLDER, subpath)
    
    # Security check: ensure the path is within UPLOAD_FOLDER
    real_path = os.path.realpath(file_path)
    upload_folder_real = os.path.realpath(UPLOAD_FOLDER)
    
    if not real_path.startswith(upload_folder_real):
        return jsonify({'error': 'Invalid file path'}), 403
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    return file_path, 200, {
        'Content-Disposition': 'attachment; filename=' + os.path.basename(file_path)
    }

@app.route('/health',