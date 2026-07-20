import os
import subprocess
from pathlib import Path
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# Create upload folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


def allowed_file(filename):
    """Check if the uploaded file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


def resize_image(image_path, output_path, width, height):
    """
    Resize an image file using ImageMagick's convert command.
    
    Args:
        image_path (str): Path to the input image file
        output_path (str): Path where the resized image will be saved
        width (int): Target width in pixels
        height (int): Target height in pixels
    
    Returns:
        dict: Dictionary with success status and message
    """
    # Validate input paths
    if not os.path.exists(image_path):
        return {'success': False, 'error': 'Input image file not found'}
    
    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    # Validate dimensions
    if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
        return {'success': False, 'error': 'Width and height must be positive integers'}
    
    # Use ImageMagick convert command to resize the image
    # The -resize option maintains aspect ratio, -extent fills to exact dimensions
    cmd = [
        'convert',
        image_path,
        '-resize', f'{width}x{height}!',  # The ! forces exact dimensions
        output_path
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            return {'success': False, 'error': f'ImageMagick error: {result.stderr}'}
        
        if not os.path.exists(output_path):
            return {'success': False, 'error': 'Output file was not created'}
        
        return {'success': True, 'message': f'Image resized successfully to {width}x{height}', 'output_path': output_path}
    
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': 'Image processing timed out'}
    except FileNotFoundError:
        return {'success': False, 'error': 'ImageMagick convert command not found. Please install ImageMagick.'}
    except Exception as e:
        return {'success': False, 'error': f'Unexpected error: {str(e)}'}


@app.route('/upload-and-resize', methods=['POST'])
def upload_and_resize():
    """
    Flask endpoint to upload an image and resize it.
    
    Expected form data:
    - file: The image file to upload
    - width: Target width in pixels
    - height: Target height in pixels
    """
    # Check if file is in request
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    # Check if file is selected
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400
    
    # Check if file extension is allowed
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': 'File type not allowed'}), 400
    
    # Get resize dimensions
    try:
        width = int(request.form.get('width', 800))
        height = int(request.form.get('height', 600))
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'Width and height must be valid integers'}), 400
    
    # Save uploaded file
    filename = secure_filename(file.filename)
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(input_path)
    
    # Create output filename
    name, ext = os.path.splitext(filename)
    output_filename = f"{name}_resized_{width}x{height}{ext}"
    output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
    
    # Resize the image
    result = resize_image(input_path, output_path, width, height)
    
    # Clean up original file if resize was successful
    if result['success'] and os.path.exists(input_path):
        os.remove(input_path)
    
    return jsonify(result)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)