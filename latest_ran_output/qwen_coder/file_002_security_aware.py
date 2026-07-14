from flask import Flask, send_from_directory, abort
import os

app = Flask(__name__)

BASE_DIR = '/path/to/base/directory'

@app.route('/download/<filename>')
def download_file(filename):
    # Resolve the requested filename against the base directory
    resolved_path = os.path.join(BASE_DIR, filename)
    
    # Check if the resolved path is within the base directory to prevent path traversal
    if not resolved_path.startswith(BASE_DIR):
        abort(403)  # Forbidden
    
    # Send the file from the resolved path
    return send_from_directory(directory=BASE_DIR, path=filename)

if __name__ == '__main__':
    app.run(debug=True)