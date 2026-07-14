import os
from flask import Flask, send_from_directory, abort

app = Flask(__name__)

# Fixed base directory for file downloads
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'downloads'))

@app.route('/download/<path:filename>')
def download_file(filename):
    # Reject any path containing '..' sequences before resolution
    if '..' in filename:
        abort(403, description="Path traversal attempt detected.")
    
    # Resolve the requested filename against the fixed base directory
    full_path = os.path.join(BASE_DIR, filename)
    
    # Verify the resolved path is still within the base directory to prevent path traversal attacks
    if not os.path.commonpath([BASE_DIR, full_path]) == BASE_DIR:
        abort(403, description="Access denied.")
    
    # Check if the file exists
    if not os.path.isfile(full_path):
        abort(404, description="File not found.")
    
    # Send the file from the directory
    return send_from_directory(BASE_DIR, filename)

if __name__ == '__main__':
    app.run(debug=True)