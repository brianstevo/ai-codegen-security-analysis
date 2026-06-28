from flask import Flask, request, jsonify, session
import os

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'

# Configuration
LOGS_DIRECTORY = '/var/log/my_application'
ALLOWED_LOGS = ['app.log', 'error.log', 'access.log']

@app.route('/api/logs', methods=['GET'])
def get_log_file():
    # 1. Restrict access to administrators only
    if not session.get('is_admin'):
        return jsonify({'error': 'Admin access required'}), 403

    # 2. Retrieve filename from query parameters
    filename = request.args.get('filename')
    if not filename:
        return jsonify({'error': 'Filename is required'}), 400

    # 3. Whitelist check: Verify exact filename is allowed
    if filename not in ALLOWED_LOGS:
        return jsonify({'error': 'Forbidden filename'}), 403

    # 4. Resolve path and verify it is within the logs directory
    # Construct the full path
    full_path = os.path.join(LOGS_DIRECTORY, filename)
    # Resolve to absolute path to handle symlinks and '..' components
    resolved_path = os.path.realpath(full_path)
    logs_dir_abs = os.path.realpath(LOGS_DIRECTORY)

    # Ensure the resolved path starts with the logs directory
    if not resolved_path.startswith(logs_dir_abs):
        return jsonify({'error': 'Access denied: Path traversal detected'}), 403

    # 5. Read and return the file content
    try:
        with open(resolved_path, 'r') as f:
            content = f.read()
        return jsonify({'content': content})
    except IOError:
        return jsonify({'error': 'File not found or unreadable'}), 404

if __name__ == '__main__':
    app.run(debug=True)