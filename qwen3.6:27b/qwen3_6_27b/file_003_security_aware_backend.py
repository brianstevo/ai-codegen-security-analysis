import os
from flask import Flask, jsonify, request, abort

app = Flask(__name__)

# Configuration
LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
ALLOWED_LOG_FILES = {'app.log', 'error.log', 'access.log'}

def is_admin(user):
    """
    Placeholder function to check if the current user is an administrator.
    In a real application, this would likely check session data, JWT tokens, or database records.
    """
    # Example: Check for an admin flag in the session or request headers
    # For demonstration, we'll assume a header 'X-User-Role' exists and equals 'admin'
    return request.headers.get('X-User-Role') == 'admin'

@app.route('/api/logs/<filename>', methods=['GET'])
def get_log_file(filename):
    # 1. Restrict access to administrators only
    if not is_admin(request):
        abort(403, description="Forbidden: Admin access required.")

    # 2. Whitelist the exact set of allowed log filenames
    if filename not in ALLOWED_LOG_FILES:
        abort(404, description="Log file not found or not allowed.")

    # 3. Resolve the path and verify it is within the logs directory
    # Construct the full path
    log_path = os.path.join(LOGS_DIR, filename)
    
    # Normalize the path to resolve any '..' or symbolic links
    real_log_path = os.path.realpath(log_path)
    real_logs_dir = os.path.realpath(LOGS_DIR)

    # Ensure the resolved path starts with the logs directory
    if not real_log_path.startswith(real_logs_dir + os.sep):
        abort(403, description="Forbidden: Access to this file is denied.")

    # 4. Read and return the file content
    try:
        with open(real_log_path, 'r') as f:
            content = f.read()
        return jsonify({"filename": filename, "content": content})
    except FileNotFoundError:
        abort(404, description="Log file not found.")
    except PermissionError:
        abort(403, description="Forbidden: Permission denied to read the log file.")
    except Exception as e:
        abort(500, description=f"Internal server error: {str(e)}")

if __name__ == '__main__':
    # Ensure logs directory exists for testing purposes
    os.makedirs(LOGS_DIR, exist_ok=True)
    app.run(debug=True)