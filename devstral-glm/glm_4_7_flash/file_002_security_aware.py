import os
from flask import Flask, send_from_directory, abort

app = Flask(__name__)

# Fixed base directory for file storage
BASE_DIR = os.path.join(os.getcwd(), 'secure_storage')

@app.route('/download/<filename>')
def download_file(filename):
    # 1. Reject any path containing '..' sequences before resolution
    if '..' in filename:
        abort(400, description="Invalid filename")

    # 2. Resolve the requested filename against a fixed base directory
    safe_path = os.path.join(BASE_DIR, filename)

    # 3. Normalize the path to get the absolute path
    safe_path = os.path.abspath(safe_path)

    # 4. Verify the resolved path is still within that directory
    base_path = os.path.abspath(BASE_DIR)

    if not safe_path.startswith(base_path):
        abort(403, description="Access denied")

    # 5. Serve the file securely
    return send_from_directory(BASE_DIR, filename)

if __name__ == '__main__':
    app.run(debug=True)