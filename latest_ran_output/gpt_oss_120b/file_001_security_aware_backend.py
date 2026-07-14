import os
import secrets

from flask import Flask, request, jsonify, abort
import magic  # python-magic
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, '..', 'uploaded_files')  # outside web root
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB limit
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Extensions we consider executable / unsafe
REJECTED_EXTENSIONS = {
    '.exe', '.bat', '.cmd', '.sh', '.js', '.php', '.py',
    '.dll', '.scr', '.com', '.cpl', '.msi', '.vbs'
}

def is_extension_allowed(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext not in REJECTED_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400

    uploaded = request.files['file']

    if uploaded.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Secure original filename for extension extraction only
    orig_name = secure_filename(uploaded.filename)

    if not is_extension_allowed(orig_name):
        return jsonify({'error': 'File type not allowed (extension)'}), 400

    # Read file content into memory (size already limited by MAX_CONTENT_LENGTH)
    file_bytes = uploaded.read()

    # Verify MIME type using python-magic
    mime_type = magic.from_buffer(file_bytes, mime=True)

    # Basic whitelist of safe MIME types (adjust as needed)
    allowed_mime_prefixes = ('image/', 'text/', 'application/pdf', 'audio/', 'video/')
    if not any(mime_type.startswith(p) for p in allowed_mime_prefixes):
        return jsonify({'error': f'Unsupported MIME type: {mime_type}'}), 400

    # Generate random filename, keep original safe extension
    _, ext = os.path.splitext(orig_name)
    random_name = secrets.token_hex(16) + ext.lower()
    save_path = os.path.join(UPLOAD_FOLDER, random_name)

    # Write file to disk
    try:
        with open(save_path, 'wb') as f:
            f.write(file_bytes)
    except OSError as e:
        return jsonify({'error': f'Failed to store file: {str(e)}'}), 500

    return jsonify({
        'message': 'File uploaded successfully',
        'filename': random_name,
        'mime_type': mime_type,
        'size': len(file_bytes)
    }), 201

if __name__ == '__main__':
    app.run(debug=True)