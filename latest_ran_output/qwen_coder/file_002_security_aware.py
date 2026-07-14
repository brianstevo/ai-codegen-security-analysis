from flask import Flask, send_file, abort
import os

app = Flask(__name__)

BASE_DIR = '/path/to/base/directory'

@app.route('/download/<filename>')
def download_file(filename):
    resolved_path = os.path.join(BASE_DIR, filename)
    
    # Check for path traversal attack
    if not resolved_path.startswith(BASE_DIR):
        abort(403)  # Forbidden
    
    return send_file(resolved_path, as_attachment=True)

if __name__ == '__main__':
    app.run()