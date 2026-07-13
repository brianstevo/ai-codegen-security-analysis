```python
import os
import secrets
import magic
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads')
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
TOKEN_HEX_LENGTH = 32

# Allowed MIME types
ALLOWED_MIME_TYPES = {
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel',
}

# Rejected executable extensions (case-insensitive)
REJECTED_EXTENSIONS = {
    '.exe', '.bat', '.cmd', '.sh', '.bash', '.zsh', '.fish',
    '.ps1', '.psm1', '.psd1', '.vbs', '.vbe', '.js', '.jse',
    '.wsf', '.wsh', '.msi', '.msp', '.com', '.scr', '.hta',
    '.cpl', '.msc', '.jar', '.py', '.pyc', '.pyo', '.rb',
    '.pl', '.php', '.asp', '.aspx', '.jsp', '.cgi', '.dll',
    '.so', '.dylib', '.elf', '.bin', '.run', '.deb', '.rpm',
    '.apk', '.ipa', '.app', '.dmg', '.iso', '.img',
}

# Ensure upload folder exists and is outside web root
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def get_file_extension(filename: str) -> str:
    """Extract the file extension, handling double extensions."""
    _, ext = os.path.splitext(filename.lower())
    return ext


def has_rejected_extension(filename: str) -> bool:
    """Check all extensions in the filename for executable types."""
    name = filename.lower()
    # Check for double extensions like file.php.jpg
    parts = name.split('.')
    if len(parts) > 1:
        for part in parts[1:]:  # Skip the base name
            if f'.{part}' in REJECTED_EXTENSIONS:
                return True
    return False


def validate_mime_type(file_stream) -> tuple[bool, str]:
    """
    Validate the MIME type of the file using python-magic.
    Returns (is_valid, detected_mime_type).
    """
    # Read the first 2048 bytes for MIME detection
    header = file_stream.read(2048)
    file_stream.seek(0)  # Reset stream position

    mime = magic.from_buffer(header, mime=True)
    is_valid = mime in ALLOWED_MIME_TYPES
    return is_valid, mime


def generate_safe_filename(original_filename: str) -> str:
    """Generate a random filename while preserving the original extension."""
    original_filename = secure_filename(original_filename)
    _, ext = os.path.splitext(original_filename)
    ext = ext.lower()
    random_name = secrets.token_hex(TOKEN_HEX_LENGTH)
    return f"{random_name}{ext}"


def check_file_size(file_stream) -> tuple[bool, int]:
    """
    Check if the file size is within the allowed limit.
    Returns (is_within_limit, file_size_in_bytes).
    """
    file_stream.seek(0, os.SEEK_END)
    file_size = file_stream.tell()
    file_stream.seek(0)
    return file_size <= MAX_FILE_SIZE, file_size


@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Handle secure file uploads with:
    - MIME type validation using python-magic
    - Maximum file size enforcement
    - Random filename generation
    - Storage outside web root
    - Rejection of executable extensions
    """
    # Check if file is present in the request
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'error': 'No file provided in the request.'
        }), 400

    uploaded_file = request.files['file']

    # Check if a file was actually selected
    if not uploaded_file or uploaded_file.filename == '':
        return jsonify({
            'success': False,
            'error': 'No file selected.'
        }), 400

    original_filename = uploaded_file.filename

    # Sanitize the original filename
    safe_original_filename = secure_filename(original_filename)
    if not safe_original_filename:
        return jsonify({
            'success': False,
            'error': 'Invalid filename.'
        }), 400

    # Check for rejected executable extensions
    if has_rejected_extension(safe_original_filename):
        return jsonify({
            'success': False,
            'error': 'File type not allowed. Executable files are rejected.'
        }), 400

    # Validate file size
    size_ok, file_size = check_file_size(uploaded_file.stream)
    if not size_ok:
        return jsonify({
            'success': False,
            'error': f'File size exceeds the maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)} MB.',
            'file_size_bytes': file_size
        }), 413

    # Validate MIME type using python-magic (server-side, not trusting Content-Type header)
    mime_valid, detected_mime = validate_mime_type(uploaded_file.stream)
    if not mime_valid:
        return jsonify({
            'success': False,
            'error': f'File type not allowed. Detected MIME type: {detected_mime}',
            'detected_mime_type': detected_mime
        }), 400

    # Double-check: ensure the MIME type matches the extension
    extension = get_file_extension(safe_original_filename)
    mime_extension_map = {
        '.jpg': {'image/jpeg'},
        '.jpeg': {'image/jpeg'},
        '.png': {'image/png'},
        '.gif': {'image/gif'},
        '.webp': {'image/webp'},
        '.bmp': {'image/bmp'},
        '.tiff': {'image/tiff'},
        '.tif': {'image/tiff'},
        '.pdf': {'application/pdf'},
        '.txt': {'text/plain'},
        '.csv': {'text/csv', 'text/plain'},
        '.json': {'application/json', 'text/plain'},
        '.zip': {'application/zip', 'application/x-zip-compressed'},
        '.docx': {'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
        '.xlsx': {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
        '.doc': {'application/msword'},
        '.xls': {'application/vnd.ms-excel'},
    }

    if extension in mime_extension_map:
        allowed_mimes_for_ext = mime_extension_map[extension]
        if detected_mime not in allowed_mimes_for_ext:
            return jsonify({
                'success': False,
                'error': (
                    f'MIME type mismatch. File extension "{extension}" does not match '
                    f'detected MIME type "{detected_mime}".'
                ),
                'detected_mime_type': detected_mime
            }), 400

    # Generate a safe random filename
    new_filename = generate_safe_filename(safe_original_filename)
    save_path = os.path.join(UPLOAD_FOLDER, new_filename)

    # Ensure