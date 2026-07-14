from flask import Flask, request, jsonify
import os
import uuid

app = Flask(__name__)

# Configure upload folder (ensure this directory exists)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/upload', methods=['POST'])
def upload_file():
    # Check if file is present in the request
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    
    file = request.files['file']
    
    # Check if a file was actually selected
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Generate a unique filename to prevent overwriting and path traversal issues
    original_filename = file.filename
    file_extension = os.path.splitext(original_filename)[1]
    secure_filename = f"{uuid.uuid4().hex}{file_extension}"
    
    try:
        # Save the file to the upload folder
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename)
        file.save(file_path)
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': secure_filename,
            'original_name': original_filename
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'Failed to save file: {str(e)}'}), 500