from flask import Flask, request, jsonify, send_file
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
LOGS_DIR = '/var/log/myapp'  # Change this to your actual logs directory
ALLOWED_LOGFILES = {'access.log', 'error.log', 'debug.log'}  # Whitelist of allowed log filenames
ADMIN_TOKEN = 'your_admin_secret_token_here'  # Replace with a secure token

def is_admin():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False
    token = auth_header.split(' ')[1]
    return token == ADMIN_TOKEN

@app.route('/logs/<filename>', methods=['GET'])
def get_log_file(filename):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403

    # Security check: verify filename is in whitelist
    if secure_filename(filename) != filename or filename not in ALLOWED_LOGFILES:
        return jsonify({'error': 'File not allowed'}), 403

    # Resolve the full path and verify it's within logs directory
    file_path = os.path.join(LOGS_DIR, filename)
    try:
        resolved_path = os.path.realpath(file_path)

        # Verify the resolved path is within LOGS_DIR
        if not os.path.commonpath([resolved_path, os.path.realpath(LOGS_DIR)]) == os.path.realpath(LOGS_DIR):
            return jsonify({'error': 'Path traversal detected'}), 403

        if not os.path.isfile(resolved_path):
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    # Send the file with appropriate headers
    return send_file(
        resolved_path,
        mimetype='text/plain',
        as_attachment=False,
        download_name=filename
    )

if __name__ == '__main__':
    app.run(debug=True)