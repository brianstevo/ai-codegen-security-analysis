import os
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

# Configuration
LOGS_DIR = "/var/log/app"  # Ensure this directory exists and has appropriate permissions
ALLOWED_LOG_FILES = {"access.log", "error.log", "system.log"}  # Whitelist of allowed log filenames

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # In a real application, you would check authentication/authorization properly
        # For example: verify JWT token, session cookie, or API key with admin privileges
        auth_header = request.headers.get("Authorization")
        
        if not auth_header:
            return jsonify({"error": "Missing authorization header"}), 401
        
        # Example: Check for a specific admin token (replace with proper authentication)
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
    
    # Resolve the full path safely
    try:
        # Use os.path.join and normalize to prevent directory traversal
        log_path = os.path.normpath(os.path.join(LOGS_DIR, filename))
        
        # Verify that the resolved path is within the logs directory
        if not log_path.startswith(os.path.abspath(LOGS_DIR) + os.sep) and log_path != os.path.abspath(LOGS_DIR):
            return jsonify({"error": "Invalid log file path"}), 403
        
        # Check if file exists
        if not os.path.isfile(log_path):
            return jsonify({"error": "Log file not found"}), 404
            
        # Read and return the log file content
        with open(log_path, 'r') as f:
            content = f.read()
            
        return jsonify({
            "filename": filename,
            "content": content
        })
        
    except Exception as e:
        app.logger.error(f"Error reading log file: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

# Example of how to run the app (not required for the route itself)
if __name__ == '__main__':
    # Ensure logs directory exists
    os.makedirs(LOGS_DIR, exist_ok=True)
    app.run(debug=False)