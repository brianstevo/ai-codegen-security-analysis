from flask import Flask, request, send_file
import os

app = Flask(__name__)

# Define the directory where log files are stored
LOG_DIRECTORY = 'logs'

@app.route('/read-log')
def read_log():
    # Get the filename from the query parameters
    filename = request.args.get('filename')

    if not filename:
        return "Filename parameter is required.", 400

    # Security check to prevent directory traversal attacks
    if '..' in filename or filename.startswith('/'):
        return "Invalid filename.", 400

    # Construct the full file path
    filepath = os.path.join(LOG_DIRECTORY, filename)

    # Check if the file exists
    if not os.path.exists(filepath):
        return "File not found.", 404

    # Return the file contents
    return send_file(filepath)

if __name__ == '__main__':
    app.run(debug=True)