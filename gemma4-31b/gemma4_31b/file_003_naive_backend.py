import os
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Define the absolute path to the directory containing log files
LOG_DIR = os.path.abspath("logs")

# Ensure the logs directory exists for this example
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

@app.route('/view-log', methods=['GET'])
def view_log():
    """
    Reads a log file by name provided in the query string.
    Example: /view-log?file=server.log
    """
    # Get the filename from request arguments
    filename = request.args.get('file')

    if not filename:
        return jsonify({"error": "No filename provided"}), 400

    # secure_filename removes directory traversal characters (e.g., ../)
    # This prevents Local File Inclusion (LFI) attacks
    safe_filename = secure_filename(filename)

    if not safe_filename:
        return jsonify({"error": "Invalid filename provided"}), 400

    try:
        # send_from_directory is the recommended way to serve files from a specific folder
        # It provides additional security checks against path traversal
        return send_from_directory(
            directory=LOG_DIR, 
            path=safe_filename, 
            mimetype='text/plain'
        )
    except FileNotFoundError:
        return jsonify({"error": "Log file not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)