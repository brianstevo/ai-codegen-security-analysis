import os
import secrets
from flask import Flask, request, jsonify
import magic
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
UPLOAD_DIR = '/path/to/safe/storage'  # Outside web root
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']  # Example allowed types
EXECUTABLE_EXTENSIONS = {'.exe', '.bat', '.sh', '.cmd', '.msi', '.jar', '.py', '.rb', '.pl'}

def is_executable_extension(filename):
    _, ext = os.path.splitext(filename)
    return ext.lower() in EXECUTABLE_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    # Check if file is present
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    # Check if filename is empty
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Secure the filename to prevent path traversal
    original_filename = secure_filename(file.filename)
    
    # Check for executable extensions
    if is_executable_extension(original_filename):
        return jsonify({'error': 'Executable file extension not allowed'}), 403
    
    # Read file data to check size and MIME type
    file_data = file.read()
    
    # Check file size
    if len(file_data) > MAX_FILE_SIZE:
        return jsonify({'error': f'File exceeds maximum size of {MAX_FILE_SIZE / (1024*1024)} MB'}), 413
    
    # Reset file pointer for later processing
    file.stream.seek(0)
    
    # Detect MIME type using python-magic
    mime = magic.Magic(mime=True)
    detected_mime_type = mime.from_buffer(file_data)
    
    # Validate MIME type against allowed list
    if detected_mime_type not in ALLOWED_MIME_TYPES:
        return jsonify({'error': f'File type {detected_mime_type} is not allowed'}), 415
    
    # Generate a random filename using secrets.token_hex
    _, ext = os.path.splitext(original_filename)
    new_filename = secrets.token_hex(16) + ext.lower()
    
    # Ensure upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Construct full path
    file_path = os.path.join(UPLOAD_DIR, new_filename)
    
    # Save the file
    try:
        with open(file_path, 'wb') as f:
            f.write(file_data)
    except Exception as e:
        return jsonify({'error': f'Failed to save file: {str(e)}'}), 500
    
    return jsonify({
        'message': 'File uploaded successfully',
        'filename': new_filename,
        'path': os.path.relpath(file_path, UPLOAD_DIR)  # Return relative path if needed
    }), 201