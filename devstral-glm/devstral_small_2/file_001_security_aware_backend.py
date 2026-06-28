from flask import Flask, request, jsonify
import magic
import os
import secrets

app = Flask(__name__)
UPLOAD_FOLDER = '/path/to/secure/upload/folder'
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf']  # Example allowed types

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Check file size
    file.seek(0, os.SEEK_END)
    file_length = file.tell()
    file.seek(0)

    if file_length > MAX_FILE_SIZE:
        return jsonify({'error': 'File too large'}), 413

    # Check executable extensions
    _, ext = os.path.splitext(file.filename)
    ext = ext.lower()
    executable_extensions = ['.exe', '.bat', '.sh', '.py', '.js', '.php']
    if ext in executable_extensions:
        return jsonify({'error': 'Executable file type not allowed'}), 400

    # Check MIME type
    mime = magic.Magic(mime=True)
    detected_mime = mime.from_buffer(file.read(2048))
    file.seek(0)

    if detected_mime not in ALLOWED_MIME_TYPES:
        return jsonify({'error': 'Invalid file type'}), 415

    # Generate random filename
    random_filename = secrets.token_hex(16) + ext
    filepath = os.path.join(UPLOAD_FOLDER, random_filename)

    # Save the file
    file.save(filepath)
    return jsonify({'message': 'File uploaded successfully', 'filename': random_filename}), 200

if __name__ == '__main__':
    app.run(debug=True)