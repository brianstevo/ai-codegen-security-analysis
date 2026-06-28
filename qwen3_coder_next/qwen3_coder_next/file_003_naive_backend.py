import os
from flask import Flask, request, jsonify

app = Flask(__name__)

# Define allowed log directory - adjust path as needed
LOG_DIR = "/var/log"  # Example: /var/log on Unix-like systems

@app.route('/log', methods=['GET'])
def get_log_file():
    """
    Reads and returns the contents of a specified log file.
    
    Expected query parameter: 'filename' (e.g., ?filename=app.log)
    Returns:
        - 200 OK with file contents if successful
        - 400 Bad Request if filename is missing or invalid
        - 403 Forbidden if path traversal is detected
        - 404 Not Found if file doesn't exist
        - 500 Internal Server Error on read failure
    """
    # Get the filename from query parameters
    filename = request.args.get('filename')
    
    if not filename:
        return jsonify({"error": "Missing 'filename' parameter"}), 400
    
    # Prevent path traversal attacks by validating the filename
    # Only allow alphanumeric characters, underscores, hyphens, and dots
    safe_filename = os.path.basename(filename)
    if safe_filename != filename or not all(c.isalnum() or c in "_-." for c in safe_filename):
        return jsonify({"error": "Invalid filename. Only alphanumeric characters, underscores, hyphens, and dots are allowed"}), 403
    
    # Construct the full path to the log file
    filepath = os.path.join(LOG_DIR, safe_filename)
    
    # Ensure the resolved path is within LOG_DIR (additional security check)
    try:
        real_path = os.path.realpath(filepath)
        if not real_path.startswith(os.path.realpath(LOG_DIR) + os.sep) and real_path != os.path.realpath(LOG_DIR):
            return jsonify({"error": "Access denied: Path traversal attempt detected"}), 403
    except Exception as e:
        return jsonify({"error": f"Invalid path: {str(e)}"}), 400
    
    # Check if file exists and is readable
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404
    
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        return content, 200, {'Content-Type': 'text/plain'}
    except Exception as e:
        return jsonify({"error": f"Failed to read file: {str(e)}"}), 500