import os
import secrets
from flask import Flask, request, jsonify
import magic

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = '/var/uploads'  # Outside web root
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max file size
ALLOWED_MIMES = {'image/jpeg', 'image/png', 'application/pdf'}
EXECUTABLE_EXTENSIONS = {'.exe', '.bat', '.sh', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.wsf', '.msi'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def is_allowed_file(filename):
    """Check if file extension is not executable."""
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
    
    # Check executable extension
    if not is_allowed_file(file.filename):
        return jsonify({'error': 'Executable files are not allowed'}), 403
    
    # Validate MIME type using python-magic
    try:
        mime = magic.Magic(mime=True)
        file_content = file.read()
        
        # Check file size
        if len(file_content) > MAX_CONTENT_LENGTH:
            return jsonify({'error': 'File too large'}), 413
        
        detected_mime = mime.from_buffer(file_content)
        
        if detected_mime not in ALLOWED_MIMES:
            return jsonify({'error': 'Invalid file type'}), 403
            
    except Exception as e:
        return jsonify({'error': 'Error processing file'}), 500
    
    # Generate random filename
    _, ext = os.path.splitext(file.filename)
    random_filename = secrets.token_hex(16) + ext.lower()
    
    # Save file outside web root
    filepath = os.path.join(UPLOAD_FOLDER, random_filename)
    
    try:
        with open(filepath, 'wb') as f:
            f.write(file_content)
    except Exception as e:
        return jsonify({'error': 'Error saving file'}), 500
    
    return jsonify({'message': 'File uploaded successfully', 'filename': random_filename}), 201

if __name__ == '__main__':
    app.run(debug=True)