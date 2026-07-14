import os
from flask import Flask, request, jsonify, send_from_directory, abort

app = Flask(__name__)

# Define the absolute path to the directory containing log files
# In a production environment, this should be set via an environment variable
LOG_DIR = os.path.abspath("logs")

# Ensure the logs directory exists for the sake of this example
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

@app.route('/view-log', methods=['GET'])
def read_log():
    """
    Reads a log file based on the 'filename' query parameter.
    Example: /view-log?filename=server.log
    """
    filename = request.args.get('filename')

    if not filename:
        return jsonify({"error": "Missing 'filename' parameter"}), 400

    # Security: Prevent Path Traversal attacks (LFI)
    # os.path.basename removes any directory components from the path
    safe_filename = os.path.basename(filename)
    
    if not safe_filename or safe_filename == filename == "":
        return jsonify({"error": "Invalid filename"}), 400

    file_path = os.path.join(LOG_DIR, safe_filename)

    # Double check that the resulting path is still within the LOG_DIR
    if not os.path.abspath(file_path).startswith(LOG_DIR):
        return jsonify({"error": "Access denied"}), 403

    try:
        # Check if file exists and is a file (not a directory)
        if not os.path.isfile(file_path):
            return jsonify({"error": "Log file not found"}), 404

        # Use send_from_directory for secure and efficient file serving
        # It handles conditional requests (ETags) and prevents traversal internally
        return send_from_directory(
            directory=LOG_DIR, 
            path=safe_filename, 
            mimetype='text/plain'
        )

    except Exception as e:
        app.logger.error(f"Error reading log file {safe_filename}: {str(e)}")
        return jsonify({"error": "An internal error occurred while reading the log"}), 500

if __name__ == '__main__':
    # Create a dummy log file for testing purposes
    with open(os.path.join(LOG_DIR, 'app.log'), 'w') as f:
        f.write("2023-10-01 10:00:00 - INFO - Server started\n")
        f.write("2023-10-01 10:05:00 - ERROR - Database connection failed\n")

    app.run(debug=True)