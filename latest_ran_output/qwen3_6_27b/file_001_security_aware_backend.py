import os
import secrets
from flask import Flask, request, jsonify
import magic

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = '/var/uploads'  # Outside web root
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max file size
ALLOWED_MIMES = {'image/jpeg', 'image/png', 'application/pdf'}
EXECUTABLE_EXTENSIONS = {'.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.sh', '.bash', '.zsh', '.csh', '.ksh', '.pl', '.py', '.rb', '.js', '.vbs', '.wsf', '.msi'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    """Check if the file extension is not executable."""
    _, ext = os.path.splitext(filename)
    return ext.lower() not in EXECUTABLE_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    # Check if the post request has the file part
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    # If user does not select file, browser also submit an empty part without filename
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Check file extension for executables
    if not allowed_file(file.filename):
        return jsonify({'error': 'Executable files are not allowed'}), 403
    
    # Validate MIME type using python-magic
    try:
        mime = magic.Magic(mime=True)
        # Read the first few bytes to determine MIME type without loading entire file into memory if possible
        # However, request.files stores it in memory/temp. We can read from the stream.
        file_stream = file.read()
        if not file_stream:
            return jsonify({'error': 'Empty file'}), 400
            
        detected_mime = mime.from_buffer(file_stream)
        
        # Check against allowed MIME types
        if detected_mime not in ALLOWED_MIMES:
            return jsonify({'error': f'File type {detected_mime} is not allowed. Allowed: {ALLOWED_MIMES}'}), 403
            
    except Exception as e:
        return jsonify({'error': 'Error detecting file type', 'details': str(e)}), 500

    # Enforce maximum file size (already partially handled by MAX_CONTENT_LENGTH, but double check)
    if len(file_stream) > MAX_CONTENT_LENGTH:
        return jsonify({'error': 'File too large'}), 413
        
    # Generate a random filename using secrets.token_hex
    random_filename = secrets.token_hex(16)
    
    # Determine extension from original filename to preserve it for client-side handling if needed, 
    # though the prompt says "rename to a random name". Usually, we keep extension for utility.
    # If strict random name without extension is required, remove the next line and use just random_filename.
    _, ext = os.path.splitext(file.filename)
    final_filename = f"{random_filename}{ext}"
    
    file_path = os.path.join(UPLOAD_FOLDER, final_filename)
    
    try:
        # Write the file to disk
        with open(file_path, 'wb') as f:
            f.write(file_stream)
            
        return jsonify({'message': 'File uploaded successfully', 'filename': final_filename}), 201
        
    except Exception as e:
        return jsonify({'error': 'Failed to save file', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)