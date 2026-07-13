from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import magic
import secrets
import os
from pathlib import Path

app = Flask(__name__)

# Configuration
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
FORBIDDEN_EXTENSIONS = {
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr',
    '.vbs', '.js', '.jar', '.zip', '.rar', '.7z',
    '.sh', '.bash', '.py', '.php', '.asp', '.aspx',
    '.jsp', '.pl', '.cgi', '.dll', '.so', '.dylib'
}

# Create upload directory outside web root
UPLOAD_DIR = Path(os.path.dirname(os.path.abspath(__file__))) / '..' / 'uploads'
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def get_mime_type(file_path):
    """Get MIME type using python-magic"""
    mime = magic.Magic(mime=True)
    return mime.from_file(str(file_path))

def validate_file_extension(filename):
    """Check if file extension is not in forbidden list"""
    ext = Path(filename).suffix.lower()
    return ext not in FORBIDDEN_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    """
    File upload endpoint with comprehensive validation
    """
    # Check if file is present in request
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Get original filename for extension validation
    original_filename = secure_filename(file.filename)
    
    # Validate extension before anything else
    if not validate_file_extension(original_filename):
        return jsonify({'error': f'File type not allowed: {Path(original_filename).suffix}'}), 400
    
    # Check file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Reset to beginning
    
    if file_size > MAX_FILE_SIZE:
        return jsonify({
            'error': f'File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB',
            'size': file_size
        }), 413
    
    # Save file temporarily to validate MIME type
    temp_path = UPLOAD_DIR / f'temp_{secrets.token_hex(8)}'
    try:
        file.save(str(temp_path))
        
        # Validate MIME type using magic
        detected_mime = get_mime_type(temp_path)
        
        if detected_mime not in ALLOWED_MIME_TYPES:
            temp_path.unlink()  # Delete temp file
            return jsonify({
                'error': f'File type not allowed. Detected: {detected_mime}',
                'allowed_types': ALLOWED_MIME_TYPES
            }), 415
        
        # Generate random filename while preserving extension
        file_ext = Path(original_filename).suffix
        new_filename = f'{secrets.token_hex(16)}{file_ext}'
        final_path = UPLOAD_DIR / new_filename
        
        # Move temp file to final location with random name
        temp_path.rename(final_path)
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': new_filename,
            'original_filename': original_filename,
            'size': file_size,
            'mime_type': detected_mime,
            'path': str(final_path)
        }), 201
    
    except Exception as e:
        # Clean up temp file if it exists
        if temp_path.exists():
            temp_path.unlink()
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)