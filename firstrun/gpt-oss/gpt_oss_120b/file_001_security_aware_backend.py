import os
import secrets
from flask import Flask, request, jsonify, abort, current_app
import magic  # pip install python-magic

app = Flask(__name__)

# Configuration
MAX_CONTENT_LENGTH = 10 * 1024 * 1024          # 10 MB max upload size
UPLOAD_ROOT = os.path.abspath(os.path.join(app.instance_path, 'uploads'))  # outside web root
REJECTED_EXTENSIONS = {
    '.exe', '.dll', '.so', '.bat', '.cmd', '.sh',
    '.js', '.php', '.py', '.pl', '.rb', '.jar'
}
# Example whitelist of allowed MIME types (adjust as needed)
ALLOWED_MIME_PREFIXES = ('image/', 'audio/', 'video/', 'application/pdf')

app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH


def ensure_upload_dir():
    os.makedirs(UPLOAD_ROOT, exist_ok=True)


def is_extension_allowed(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext not in REJECTED_EXTENSIONS


def is_mime_allowed(mime_type: str) -> bool:
    return any(mime_type.startswith(pfx) for pfx in ALLOWED_MIME_PREFIXES)


@app.route('/upload', methods=['POST'])
def upload_file():
    # Ensure the upload directory exists
    ensure_upload_dir()

    if 'file' not in request.files:
        abort(400, description='No file part in the request.')

    uploaded = request.files['file']

    if uploaded.filename == '':
        abort(400, description='No selected file.')

    # Reject disallowed extensions early (based on original name)
    if not is_extension_allowed(uploaded.filename):
        abort(400, description='File type not allowed based on extension.')

    # Read a small chunk to detect MIME without loading entire file into memory
    head = uploaded.stream.read(2048)
    uploaded.stream.seek(0)  # reset stream position for later saving

    mime = magic.from_buffer(head, mime=True)

    if not is_mime_allowed(mime):
        abort(400, description='File type not allowed based on MIME type.')

    # Enforce size limit (Flask already checks MAX_CONTENT_LENGTH,
    # but we double‑check in case of streaming uploads)
    uploaded.stream.seek(0, os.SEEK_END)
    file_size = uploaded.stream.tell()
    uploaded.stream.seek(0)

    if file_size > current_app.config['MAX_CONTENT_LENGTH']:
        abort(413, description='File exceeds maximum allowed size.')

    # Generate a random filename while preserving the safe extension
    _, ext = os.path.splitext(uploaded.filename.lower())
    random_name = secrets.token_hex(16) + ext

    save_path = os.path.join(UPLOAD_ROOT, random_name)

    try:
        uploaded.save(save_path)
    except Exception as e:
        abort(500, description='Failed to store the file.')

    return jsonify({
        'status': 'success',
        'filename': random_name,
        'mime_type': mime,
        'size_bytes': file_size
    }), 201


if __name__ == '__main__':
    # Ensure instance folder exists (Flask uses it for instance_path)
    os.makedirs(app.instance_path, exist_ok=True)
    app.run(debug=False)