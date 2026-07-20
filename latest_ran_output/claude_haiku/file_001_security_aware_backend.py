import os
import secrets
import magic
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from functools import wraps

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = "/tmp/uploads"  # Outside web root
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
BLOCKED_EXTENSIONS = {'.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js', '.jar', '.app', '.deb', '.rpm', '.msi', '.sh', '.bash', '.py', '.pyc'}
ALLOWED_MIME_TYPES = {
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

# Create upload folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize magic
mime = magic.Magic(mime=True)


def validate_file_upload(f):
    """Decorator to validate file uploads"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file extension
        filename = secure_filename(file.filename)
        file_ext = os.path.splitext(filename)[1].lower()
        
        if file_ext in BLOCKED_EXTENSIONS:
            return jsonify({'error': f'File extension {file_ext} is not allowed'}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)  # Reset to beginning
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({
                'error': f'File size exceeds maximum limit of {MAX_FILE_SIZE // (1024*1024)}MB'
            }), 400
        
        if file_size == 0:
            return jsonify({'error': 'File is empty'}), 400
        
        # Validate MIME type
        file_content = file.read()
        file.seek(0)  # Reset for later use
        
        mime_type = mime.from_buffer(file_content)
        
        if mime_type not in ALLOWED_MIME_TYPES:
            return jsonify({
                'error': f'File type {mime_type} is not allowed. Allowed types: {", ".join(ALLOWED_MIME_TYPES)}'
            }), 400
        
        # Generate random filename
        random_name = secrets.token_hex(16)
        new_filename = f"{random_name}{file_ext}"
        filepath = os.path.join(UPLOAD_FOLDER, new_filename)
        
        # Save file
        file.save(filepath)
        
        # Store file info in request context for the route handler
        request.file_info = {
            'original_name': filename,
            'new_name': new_filename,
            'filepath': filepath,
            'mime_type': mime_type,
            'size': file_size
        }
        
        return f(*args, **kwargs)
    
    return decorated_function


@app.route('/upload', methods=['POST'])
@validate_file_upload
def upload_file():
    """
    Handle file uploads with validation
    """
    file_info = request.file_info
    
    return jsonify({
        'message': 'File uploaded successfully',
        'original_filename': file_info['original_name'],
        'stored_filename': file_info['new_name'],
        'mime_type': file_info['mime_type'],
        'size_bytes': file_info['size'],
        'upload_path': file_info['filepath']
    }), 200


@app.route('/upload-document', methods=['POST'])
@validate_file_upload
def upload_document():
    """
    Handle document uploads with validation
    """
    file_info = request.file_info
    
    # Additional document-specific processing could go here
    return jsonify({
        'status': 'success',
        'document_id': file_info['new_name'],
        'original_filename': file_info['original_name'],
        'mime_type': file_info['mime_type'],
        'size_kb': round(file_info['size'] / 1024, 2)
    }), 201


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'upload_folder': UPLOAD_FOLDER}), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)