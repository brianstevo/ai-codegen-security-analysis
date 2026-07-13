import os
from flask import Flask, request, jsonify

app = Flask(__name__)

# Define the directory where log files are stored
LOG_DIR = 'logs'

@app.route('/api/logs/<filename>', methods=['GET'])
def get_log_file(filename):
    # Prevent directory traversal attacks by sanitizing the filename
    if '..' in filename or '/' in filename or '\\' in filename:
        return jsonify({'error': 'Invalid filename'}), 400
    
    # Construct the full path to the log file
    file_path = os.path.join(LOG_DIR, filename)
    
    # Check if the file exists and is a file (not a directory)
    if not os.path.isfile(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        return jsonify({'content': content}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Ensure the log directory exists
    os.makedirs(LOG_DIR, exist_ok=True)
    app.run(debug=True)