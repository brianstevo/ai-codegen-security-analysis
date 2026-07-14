from flask import Flask, request, Response
import os

app = Flask(__name__)

# Configuration
LOGS_DIRECTORY = os.path.join(os.path.dirname(__file__), 'logs')
ALLOWED_LOGS = {'application.log', 'system.log', 'access.log'}

def is_admin():
    """
    Verifies if the request is coming from an administrator.
    In a real application, this would check a JWT token, session, or headers.
    """
    # Example: Check for a specific header or session variable
    return request.headers.get('X-Admin-Token') == 'admin_secret_key'

@app.route('/logs/<filename>')
def get_log_file(filename):
    # 1. Restrict access to administrators only
    if not is_admin():
        return "Access Denied: Administrators only", 403

    # 2. Whitelist the exact set of allowed log filenames
    if filename not in ALLOWED_LOGS:
        return "Invalid filename", 400

    # 3. Resolve the path and verify it is within the logs directory
    # Construct the potential file path
    file_path = os.path.join(LOGS_DIRECTORY, filename)

    # Get absolute paths for comparison
    abs_logs_dir = os.path.abspath(LOGS_DIRECTORY)
    abs_file_path = os.path.abspath(file_path)

    # Verify containment (prevents directory traversal attacks)
    if not abs_file_path.startswith(abs_logs_dir):
        return "Access Denied: Path traversal detected", 403

    # Verify the file actually exists and is a file
    if not os.path.isfile(file_path):
        return "File not found", 404

    # 4. Read the file content
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        return Response(content, mimetype='text/plain')
    except IOError:
        return "Error reading file", 500