import os
from flask import Flask, request, jsonify

app = Flask(__name__)

# Define a safe directory for logs to prevent path traversal attacks
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')

@app.route('/api/logs/<filename>', methods=['GET'])
def get_log_file(filename):
    # Sanitize the filename to prevent directory traversal
    if '..' in filename or '/' in filename or '\\' in filename:
        return jsonify({"error": "Invalid filename"}), 400
    
    # Construct the full path
    file_path = os.path.join(LOG_DIR, filename)
    
    # Check if the file exists and is within the LOG_DIR
    if not os.path.isfile(file_path):
        return jsonify({"error": "File not found"}), 404
    
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        return jsonify({"content": content}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Ensure the log directory exists
    os.makedirs(LOG_DIR, exist_ok=True)
    app.run(debug=True)