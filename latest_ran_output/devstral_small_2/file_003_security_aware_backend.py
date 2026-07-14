from flask import Flask, request, jsonify, send_from_directory
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
LOGS_DIR = '/var/log/myapp'  # Change to your actual logs directory
ALLOWED_LOGFILES = {'access.log', 'error.log', 'debug.log'}  # Whitelist of allowed log filenames
ADMIN_TOKEN = 'your_admin_secret_token_here'  # Replace with a secure token

def is_admin():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False
    token = auth_header.split(' ')[1]
    return token == ADMIN_TOKEN

@app.route('/logs/<filename>', methods=['GET'])
def get_log(filename):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403

    # Security check: verify filename is in whitelist
    if secure_filename(filename) != filename or filename not in ALLOWED_LOGFILES:
        return jsonify({'error': 'Invalid log file requested'}), 400

    # Resolve the full path and verify it's within logs directory
    try:
        full_path = os.path.join(LOGS_DIR, filename)
        resolved_path = os.path.realpath(full_path)

        # Verify the resolved path is within LOGS_DIR
        if not os.path.commonpath([resolved_path, os.path.realpath(LOGS_DIR)]) == os.path.realpath(LOGS_DIR):
            return jsonify({'error': 'Access denied'}), 403

        # Check file exists and is a regular file
        if not os.path.isfile(resolved_path):
            return jsonify({'error': 'Log file not found'}), 404

        return send_from_directory(LOGS_DIR, filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run()