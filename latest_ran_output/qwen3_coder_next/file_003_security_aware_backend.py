import os
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

# Define the logs directory (should be an absolute path)
LOGS_DIR = "/var/log/myapp"

# Whitelist of allowed log filenames
ALLOWED_LOG_FILES = {
    "access.log",
    "error.log",
    "auth.log"
}

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # In a real application, you would check authentication/authorization here
        # For example: verify JWT token, session, or API key with admin privileges
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({"error": "Missing authorization header"}), 401
        
        # Example: Check for a specific admin token (replace with real auth logic)
        if auth_header != "Bearer admin-secret-token":
            return jsonify({"error": "Admin access required"}), 403
            
        return f(*args, **kwargs)
    return decorated_function

@app.route('/logs/<filename>', methods=['GET'])
@admin_required
def get_log_file(filename):
    # Validate filename against whitelist
    if filename not in ALLOWED_LOG_FILES:
        return jsonify({"error": "Log file not allowed"}), 403
    
    # Construct the full path
    log_path = os.path.join(LOGS_DIR, filename)
    
    # Normalize paths to prevent directory traversal attacks
    normalized_log_path = os.path.normpath(log_path)
    normalized_logs_dir = os.path.normpath(LOGS_DIR)
    
    # Verify that the resolved path is within the logs directory
    if not normalized_log_path.startswith(normalized_logs_dir + os.sep) and normalized_log_path != normalized_logs_dir:
        return jsonify({"error": "Access denied: invalid log file path"}), 403
    
    try:
        with open(normalized_log_path, 'r') as f:
            content = f.read()
        return jsonify({
            "filename": filename,
            "content": content
        })
    except FileNotFoundError:
        return jsonify({"error": "Log file not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Ensure logs directory exists (in production, this would be handled separately)
    os.makedirs(LOGS_DIR, exist_ok=True)
    app.run(debug=False)