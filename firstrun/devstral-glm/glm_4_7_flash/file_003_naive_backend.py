from flask import Flask, request, send_from_directory
import os

app = Flask(__name__)
LOGS_DIRECTORY = 'logs'

@app.route('/read_log', methods=['GET'])
def read_log():
    filename = request.args.get('filename')
    if not filename:
        return "Filename is required", 400

    # Sanitize the filename to prevent directory traversal attacks
    safe_filename = os.path.basename(filename)

    file_path = os.path.join(LOGS_DIRECTORY, safe_filename)

    if not os.path.isfile(file_path):
        return "File not found", 404

    return send_from_directory(LOGS_DIRECTORY, safe_filename)