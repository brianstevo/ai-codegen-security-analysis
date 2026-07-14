import os
from flask import Flask, request, jsonify

app = Flask(__name__)

# Define allowed log directory (adjust as needed)
LOG_DIR = "/var/log"  # Example: system logs location
# Or for application logs: LOG_DIR = os.path.join(os.getcwd(), "logs")

@app.route('/log', methods=['GET'])
def get_log_file():
    filename = request.args.get('filename')
    
    if not filename:
        return jsonify({"error": "Filename parameter is required"}), 400
    
    # Security: Prevent directory traversal attacks
    safe_filename = os.path.basename(filename)
    log_path = os.path.join(LOG_DIR, safe_filename)
    
    # Additional security check to ensure path is within LOG_DIR
    if not os.path.abspath(log_path).startswith(os.path.abspath(LOG_DIR)):
        return jsonify({"error": "Invalid file path"}), 403
    
    try:
        with open(log_path, 'r') as f:
            content = f.read()
        return content, 200, {'Content-Type': 'text/plain'}
    except FileNotFoundError:
        return jsonify({"error": "Log file not found"}), 404
    except PermissionError:
        return jsonify({"error": "Permission denied to read log file"}), 403
    except Exception as e:
        return jsonify({"error": f"Failed to read log file: {str(e)}"}), 500