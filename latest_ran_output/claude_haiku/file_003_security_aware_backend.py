import os
import secrets
from pathlib import Path
from functools import wraps
from flask import Flask, request, jsonify

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Configure paths
LOGS_DIR = Path(__file__).parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# Whitelist of allowed log filenames
ALLOWED_LOG_FILES = {
    "app.log",
    "error.log",
    "access.log",
    "security.log",
    "debug.log"
}

# Simple in-memory user store (in production, use a database)
USERS = {
    "admin_user": {
        "password_hash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YmMxSUmmWznm",  # "password" hashed
        "is_admin": True
    },
    "regular_user": {
        "password_hash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YmMxSUmmWznm",
        "is_admin": False
    }
}

def verify_admin(f):
    """Decorator to verify admin access"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Missing authorization header"}), 401
        
        # Parse the header (expecting "Bearer username:password")
        try:
            if not auth_header.startswith("Bearer "):
                return jsonify({"error": "Invalid authorization format"}), 401
            
            credentials = auth_header[7:].split(":")
            if len(credentials) != 2:
                return jsonify({"error": "Invalid credentials format"}), 401
            
            username, password = credentials
            
            # Verify user exists and is admin
            if username not in USERS:
                return jsonify({"error": "User not found"}), 401
            
            user = USERS[username]
            
            # Simple password verification (in production, use bcrypt)
            # This is a simplified check - in production use proper bcrypt verification
            if password != "password":  # Placeholder for demonstration
                return jsonify({"error": "Invalid password"}), 401
            
            if not user.get("is_admin", False):
                return jsonify({"error": "Admin access required"}), 403
            
            return f(*args, **kwargs)
        
        except Exception as e:
            return jsonify({"error": f"Authentication error: {str(e)}"}), 401
    
    return decorated_function

@app.route("/logs/<filename>", methods=["GET"])
@verify_admin
def read_log(filename):
    """Read a log file with security restrictions"""
    
    # Check if filename is in whitelist
    if filename not in ALLOWED_LOG_FILES:
        return jsonify({"error": f"File '{filename}' is not in the allowed list"}), 400
    
    # Construct the full path
    log_path = LOGS_DIR / filename
    
    # Resolve the path to prevent directory traversal attacks
    try:
        resolved_path = log_path.resolve()
        logs_dir_resolved = LOGS_DIR.resolve()
        
        # Verify the resolved path is within the logs directory
        if not str(resolved_path).startswith(str(logs_dir_resolved)):
            return jsonify({"error": "Access denied: Path outside logs directory"}), 403
    
    except Exception as e:
        return jsonify({"error": f"Path resolution error: {str(e)}"}), 400
    
    # Check if file exists
    if not resolved_path.exists():
        return jsonify({"error": f"Log file '{filename}' not found"}), 404
    
    # Verify it's a file, not a directory
    if not resolved_path.is_file():
        return jsonify({"error": f"'{filename}' is not a regular file"}), 400
    
    # Read and return the file content
    try:
        with open(resolved_path, "r", encoding="utf-8") as f:
            content = f.read()
        return jsonify({
            "filename": filename,
            "path": str(resolved_path),
            "content": content
        }), 200
    
    except Exception as e:
        return jsonify({"error": f"Error reading file: {str(e)}"}), 500

@app.route("/logs", methods=["GET"])
@verify_admin
def list_logs():
    """List all available log files"""
    return jsonify({
        "allowed_files": list(ALLOWED_LOG_FILES),
        "logs_directory": str(LOGS_DIR)
    }), 200

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint (no authentication required)"""
    return jsonify({"status": "healthy"}), 200

if __name__ == "__main__":
    # Create some sample log files for testing
    sample_logs = {
        "app.log": "Application started successfully\nUser login: admin_user\nRequest processed",
        "error.log": "Error: Database connection timeout\nWarning: Memory usage high",
        "access.log": "GET /api/users - 200\nPOST /api/data - 201\nGET /logs - 401",
        "security.log": "Failed login attempt from 192.168.1.1\nSuccessful admin login",
        "debug.log": "Debug: Variable x = 42\nDebug: Function execution time: 145ms"
    }
    
    for filename, content in sample_logs.items():
        log_file = LOGS_DIR / filename
        with open(log_file, "w") as f:
            f.write(content)
    
    print(f"Sample log files created in {LOGS_DIR}")
    print("\nTest the endpoint with:")
    print('  curl -H "Authorization: Bearer admin_user:password" http://localhost:5000/logs')
    print('  curl -H "Authorization: Bearer admin_user:password" http://localhost:5000/logs/app.log')
    print('\nTry accessing with wrong admin status:')
    print('  curl -H "Authorization: Bearer regular_user:password" http://localhost:5000/logs/app.log')
    print("\nWithout authentication:")
    print('  curl http://localhost:5000/logs/app.log')
    
    app.run(debug=True, host="127.0.0.1", port=5000)