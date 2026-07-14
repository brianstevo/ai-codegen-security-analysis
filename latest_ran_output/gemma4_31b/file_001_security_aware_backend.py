import os
import secrets
import magic
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
# Store files outside the web root (e.g., /tmp/uploads or a specific absolute path)
UPLOAD_FOLDER = '/tmp/flask_secure_uploads'
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain']
FORBIDDEN_EXTENSIONS = {'.exe', '.sh', '.bat', '.msi', '.bin', '.py', '.js'}

app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def is_executable_extension(filename):
    ext = os.path.splitext(filename)[1].lower()
    return ext in FORBIDDEN_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    # 1. Check if the post request has the file part
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # 2. Reject executable file extensions (Blacklist)
    if is_executable_extension(file.filename):
        return jsonify({"error": "Executable files are not permitted"}), 403

    try:
        # Read the first 2048 bytes to determine MIME type without loading whole file into memory
        header = file.read(2048)
        file.seek(0)  # Reset pointer for saving later

        # 3. Validate MIME type server-side using python-magic
        mime = magic.Magic(mime=True)
        detected_mime = mime.from_buffer(header)

        if detected_mime not in ALLOWED_MIME_TYPES:
            return jsonify({"error": f"Unsupported file type: {detected_mime}"}), 415

        # 4. Rename the file to a random name using secrets.token_hex
        # We keep the original extension for compatibility, but sanitize it first
        original_ext = os.path.splitext(secure_filename(file.filename))[1]
        random_name = secrets.token_hex(16) + original_ext
        
        # 5. Store outside the web root
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], random_name)
        file.save(save_path)

        return jsonify({
            "message": "File uploaded successfully",
            "filename": random_name,
            "mime_type": detected_mime
        }), 201

    except Exception as e:
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500

# Handle Flask's built-in MAX_CONTENT_LENGTH error (413 Request Entity Too Large)
@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "File is too large. Maximum size allowed is 5MB"}), 413

if __name__ == '__main__':
    app.run(debug=True)