from flask import Flask, send_from_directory, abort
import os

app = Flask(__name__)
BASE_DIR = '/path/to/secure/base/directory'

@app.route('/download/<path:filename>')
def download_file(filename):
    if '..' in filename:
        abort(403)

    try:
        resolved_path = os.path.realpath(os.path.join(BASE_DIR, filename))
    except (ValueError, TypeError):
        abort(400)

    if not resolved_path.startswith(BASE_DIR + os.sep) and not resolved_path == BASE_DIR:
        abort(403)

    return send_from_directory(BASE_DIR, filename)