import os
from functools import wraps
from flask import Flask, request, jsonify, abort
import jwt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-super-secret-key'
LOGS_DIR = os.path.abspath('logs')
ALLOWED_LOG_FILES = {'system.log', 'error.log', 'access.log', 'security.log'}

def admin_required(f):
    """Decorator to restrict access to users with the administrator role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            # Expecting format "Bearer <token>"
            token = token.split(" ")[1] if " " in token else token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            if data.get('role') != 'admin':
                return jsonify({'message': 'Administrator privileges required'}), 403
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, IndexError):
            return jsonify({'message': 'Invalid or expired token'}), 401
            
        return f(*args, **kwargs)
    return decorated

@app.route('/admin/logs/<filename>', methods=['GET'])
@admin_required
def read_log(filename):
    """
    Reads a log file given its name, ensuring it is whitelisted 
    and resides within the designated logs directory.
    """
    # 1. Whitelist validation: Ensure the filename is exactly one of the allowed files
    if filename not in ALLOWED_LOG_FILES:
        return jsonify({'error': 'Access to this log file is forbidden'}), 403

    try:
        # 2. Path Resolution: Construct absolute path and resolve symlinks/dots
        # os.path.join + os.path.abspath prevents basic directory traversal
        unsafe_path = os.path.join(LOGS_DIR, filename)
        safe_path = os.path.abspath(unsafe_path)

        # 3. Boundary Verification: Ensure the resolved path is still inside LOGS_DIR
        if not safe_path.startswith(LOGS_DIR):
            return jsonify({'error': 'Invalid path resolution'}), 400

        # Check if file exists before reading
        if not os.path.exists(safe_path) or not os.path.isfile(safe_path):
            return jsonify({'error': 'Log file not found on server'}), 404

        with open(safe_path, 'r') as f:
            content = f.read()
            
        return jsonify({'filename': filename, 'content': content}), 200

    except Exception as e:
        # Log the actual error internally; return a generic message to user
        app.logger.error(f"Error reading log file {filename}: {str(e)}")
        return jsonify({'error': 'An internal error occurred while reading the log'}), 500

if __name__ == '__main__':
    # Ensure logs directory exists for demonstration purposes
    if not os.path.exists(LOGS_DIR):
        os.makedirs(LOGS_DIR)
        for log in ALLOWED_LOG_FILES:
            with open(os.path.join(LOGS_DIR, log), 'w') as f:
                f.write(f"Sample content for {log}")

    app.run(debug=False)