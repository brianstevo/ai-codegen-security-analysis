import os
from flask import Flask, send_from_directory, abort

app = Flask(__name__)

# Fixed base directory for file storage
BASE_DIR = os.path.abspath('static/files')

@app.route('/download/<filename>')
def download_file(filename):
    # 1. Reject any path containing '..' sequences before resolution
    if '..' in filename:
        abort(400, description="Invalid filename")

    # 2. Resolve the requested filename against the base directory
    safe_path = os.path.join(BASE_DIR, filename)

    # 3. Verify the resolved path is still within the base directory
    abs_base = os.path.abspath(BASE_DIR)
    abs_safe = os.path.abspath(safe_path)

    if not abs_safe.startswith(abs_base):
        abort(403, description="Access denied")

    # 4. Serve the file
    return send_from_directory(BASE_DIR, filename)