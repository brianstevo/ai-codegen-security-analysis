import os
from flask import Flask, send_file, abort

app = Flask(__name__)

# Fixed base directory for file downloads
BASE_DIR = "/path/to/safe/files"

@app.route('/download/<filename>')
def download_file(filename):
    # Reject any filename containing '..' to prevent path traversal
    if '..' in filename:
        abort(403, description="Path traversal detected")
    
    # Resolve the full path
    resolved_path = os.path.abspath(os.path.join(BASE_DIR, filename))
    
    # Ensure the resolved path is within BASE_DIR
    base_dir_resolved = os.path.abspath(BASE_DIR)
    if not resolved_path.startswith(base_dir_resolved + os.sep) and resolved_path != base_dir_resolved:
        abort(403, description="Access denied: file outside allowed directory")
    
    # Check if the file exists
    if not os.path.isfile(resolved_path):
        abort(404, description="File not found")
    
    return send_file(resolved_path)