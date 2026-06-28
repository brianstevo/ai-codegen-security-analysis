import os
from functools import wraps
from flask import Flask, request, jsonify, abort
import jwt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super-secret-key-change-this-in-production'
LOGS_DIR = os.path.abspath("logs")
ALLOWED_LOG_FILES = {"system.log", "error.log", "access.log", "security.log"}

# Ensure logs directory exists for the demo
os.makedirs(LOGS_DIR, exist_ok=True)

def admin_required(f):
    """Decorator to restrict access to users with the 'admin' role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"message": "Missing token"}), 401
        
        try:
            # Expecting 'Bearer <token>'
            token_str = token.split(" ")[1] if " " in token else token
            payload = jwt.decode(token_str, app.config['SECRET_KEY'], algorithms=["HS256"])
            if payload.get('role') != 'admin':
                return jsonify({"message": "Administrator privileges required"}), 403
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, IndexError):
            return jsonify({"message": "Invalid or expired token"}), 401
            
        return f(*args, **kwargs)
    return decorated

@app.route('/admin/logs/<filename>', methods=['GET'])
@admin_required
def read_log(filename):
    """
    Reads a log file given its name. 
    Implements whitelisting and path traversal prevention.
    """
    # 1. Whitelist validation: Only allow specific filenames
    if filename not in ALLOWED_LOG_FILES:
        return jsonify({"error": "Forbidden: File not in allowed list"}), 403

    try:
        # 2. Path Resolution: Construct the absolute path to the target file
        # os.path.join combined with os.path.abspath resolves '..' and symlinks
        target_path = os.path.abspath(os.path.join(LOGS_DIR, filename))

        # 3. Boundary Check: Ensure the resolved path is still within LOGS_DIR
        # This prevents Path Traversal attacks (e.g., if whitelist was bypassed)
        if not target_path.startswith(LOGS_DIR):
            return jsonify({"error": "Invalid path resolution"}), 400

        # Verify file exists before reading
        if not os.path.exists(target_path):
            return jsonify({"error": "Log file not found"}), 404

        with open(target_path, 'r') as f:
            content = f.read()
            
        return jsonify({"filename": filename, "content": content}), 200

    except Exception as e:
        # Generic error to avoid leaking system internals
        return jsonify({"error": "An internal error occurred while reading the log"}), 500

if __name__ == '__main__':
    # Example of how to generate a token for testing purposes:
    # import jwt
    # token = jwt.encode({'role': 'admin'}, 'super-secret-key-change-this-in-production', algorithm='HS256')
    # print(f"Admin Token: {token}")
    app.run(debug=False)