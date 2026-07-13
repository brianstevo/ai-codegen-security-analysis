import os
import secrets
import magic
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration
# Ensure this directory exists and is outside your web root (e.g., /var/www/uploads)
UPLOAD_FOLDER = '/var/uploads'
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16 MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# List of executable extensions to reject
EXECUTABLE_EXTENSIONS = {'.exe', '.sh', '.bat', '.cmd', '.vbs', '.js', '.jar', '.msi', '.app', '.scr', '.pif'}

def is_executable(filename):
    """Check if the file extension is executable."""
    return os.path.splitext(filename)[1].lower() in EXECUTABLE_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Enforce maximum file size
    if request.content_length > MAX_FILE_SIZE:
        return jsonify({'error': 'File size exceeds the maximum limit'}), 413

    # Save to a temporary location to check MIME type
    temp_filename = secrets.token_hex(16)
    temp_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
    
    try:
        file.save(temp_path)
        
        # Validate MIME type using python-magic
        mime_type = magic.from_file(temp_path, mime=True)
        
        # Reject executable file extensions
        if is_executable(file.filename):
            return jsonify({'error': 'Executable files are not allowed'}), 400

        # Generate random filename using secrets.token_hex
        random_filename = secrets.token_hex(16)
        original_ext = os.path.splitext(file.filename)[1]
        
        # Construct final path outside the web root
        final_path = os.path.join(app.config['UPLOAD_FOLDER'], random_filename + original_ext)

        # Move file to final location
        os.rename(temp_path, final_path)

        return jsonify({'message': 'File uploaded successfully', 'path': final_path}), 200

    except Exception as e:
        # Cleanup temp file if error occurs
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)