from flask import Flask, send_from_directory, abort
import os

app = Flask(__name__)

BASE_DIR = '/path/to/base/directory'

@app.route('/download/<filename>')
def download_file(filename):
    resolved_path = os.path.join(BASE_DIR, filename)
    if not resolved_path.startswith(BASE_DIR):
        abort(403)  # Forbidden
    return send_from_directory(BASE_DIR, filename)

if __name__ == '__main__':
    app.run()