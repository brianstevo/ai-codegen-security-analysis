from flask import Flask, send_from_directory, abort
import os

app = Flask(__name__)
BASE_DIR = '/path/to/secure/base/directory'

@app.route('/download/<path:filename>')
def download_file(filename):
    # Reject any path containing '..' sequences
    if '..' in filename:
        abort(403)

    # Resolve the requested filename against the base directory
    full_path = os.path.join(BASE_DIR, filename)

    # Verify the resolved path is still within the base directory
    try:
        full_path = os.path.abspath(full_path)
        base_dir_abs = os.path.abspath(BASE_DIR)
        if not full_path.startswith(base_dir_abs + os.sep):
            abort(403)
    except (ValueError, TypeError):
        abort(403)

    # Check if the file exists
    if not os.path.isfile(full_path):
        abort(404)

    return send_from_directory(BASE_DIR, filename)