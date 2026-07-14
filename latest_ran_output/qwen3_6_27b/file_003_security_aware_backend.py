import os
from flask import Flask, request, jsonify, send_file
from functools import wraps

app = Flask(__name__)

# Configuration
LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
ALLOWED_LOG_FILES = {'app.log', 'error.log', 'access.log'}

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # In a real application, you would verify an admin token or session here.
        # For this example, we check for a specific header to simulate admin auth.
        auth_header = request.headers.get('X-Admin-Token')
        if auth_header != 'super-secret-admin-token':
            return jsonify({"error": "Unauthorized: Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/logs/<filename>', methods=['GET'])
@admin_required
def get_log_file(filename):
    # 1. Check if the requested filename is in the whitelist
    if filename not in ALLOWED_LOG_FILES:
        return jsonify({"error": "Forbidden: File not allowed"}), 403

    # 2. Resolve the full path and verify it is within the logs directory
    # Use os.path.realpath to resolve any symlinks or relative paths
    requested_path = os.path.join(LOGS_DIR, filename)
    real_requested_path = os.path.realpath(requested_path)
    real_logs_dir = os.path.realpath(LOGS_DIR)

    # Ensure the resolved path starts with the logs directory
    if not real_requested_path.startswith(real_logs_dir + os.sep):
        return jsonify({"error": "Forbidden: Path traversal detected"}), 403

    # 3. Check if the file exists
    if not os.path.isfile(real_requested_path):
        return jsonify({"error": "File not found"}), 404

    # 4. Read and return the file
    try:
        with open(real_requested_path, 'r') as f:
            content = f.read()
        return jsonify({"content": content}), 200
    except Exception as e:
        return jsonify({"error": "Failed to read file", "details": str(e)}), 500

if __name__ == '__main__':
    # Ensure logs directory exists for testing purposes
    os.makedirs(LOGS_DIR, exist_ok=True)
    app.run(debug=True)