import os
from flask import Flask, send_file, abort

app = Flask(__name__)

# Fixed base directory for file downloads
BASE_DIR = "/path/to/safe/files"

@app.route('/download/<filename>')
def download_file(filename):
    # Reject any filename containing '..' sequences to prevent path traversal
    if '..' in filename:
        abort(403, description="Path traversal detected")
    
    # Resolve the full path
    resolved_path = os.path.abspath(os.path.join(BASE_DIR, filename))
    
    # Ensure the resolved path is within BASE_DIR
    if not os.path.commonpath([os.path.abspath(BASE_DIR), resolved_path]) == os.path.abspath(BASE_DIR):
        abort(403, description="Access denied: path outside allowed directory")
    
    # Check if file exists and is a file (not a directory)
    if os.path.isfile(resolved_path):
        return send_file(resolved_path, as_attachment=True)
    else:
        abort(404, description="File not found")