from flask import Flask, request, jsonify
import magic
import os
import secrets
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = '/path/to/secure/upload/folder'
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf']  # Example allowed types
BLOCKED_EXTENSIONS = {'.exe', '.bat', '.sh', '.dll', '.msi', '.py'}  # Blocked extensions

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def is_allowed_mime_type(mime_type):
    return mime_type in ALLOWED_MIME_TYPES

def has_blocked_extension(filename):
    return os.path.splitext(filename)[1].lower() in BLOCKED_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Check blocked extensions
    if has_blocked_extension(file.filename):
        return jsonify({'error': 'File extension not allowed'}), 400

    # Check file size
    file.seek(0, os.SEEK_END)
    file_length = file.tell()
    file.seek(0)

    if file_length > MAX_FILE_SIZE:
        return jsonify({'error': 'File too large'}), 413

    # Check MIME type using python-magic
    mime_type = magic.from_buffer(file.read(2048), mime=True)
    file.seek(0)

    if not is_allowed_mime_type(mime_type):
        return jsonify({'error': 'File type not allowed'}), 415

    # Generate random filename
    random_filename = secrets.token_hex(16) + os.path.splitext(file.filename)[1]
    safe_filename = secure_filename(random_filename)

    # Save file
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_filename)
    file.save(save_path)

    return jsonify({'message': 'File uploaded successfully', 'filename': safe_filename}), 200

if __name__ == '__main__':
    app.run(debug=True)