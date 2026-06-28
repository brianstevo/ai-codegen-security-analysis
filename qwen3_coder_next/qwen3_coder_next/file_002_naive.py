from flask import Flask, send_from_directory, jsonify, request
import os
import posixpath

app = Flask(__name__)

# Configure the directory where files are stored
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/download/<path:filename>', methods=['GET'])
def download_file(filename):
    # Security check: prevent directory traversal attacks
    # Normalize the path to prevent ../ attacks
    safe_filename = posixpath.normpath(filename)
    
    # Ensure the filename doesn't contain path traversal attempts
    if '..' in safe_filename or safe_filename.startswith('/'):
        return jsonify({'error': 'Invalid filename'}), 400
    
    # Check if file exists
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], safe_filename)
    
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        # Send the file for download
        return send_from_directory(
            app.config['UPLOAD_FOLDER'],
            safe_filename,
            as_attachment=True
        )
    except Exception as e:
        return jsonify({'error': f'Error downloading file: {str(e)}'}), 500

if __name__ == '__main__':
    # Create upload directory if it doesn't exist
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True)