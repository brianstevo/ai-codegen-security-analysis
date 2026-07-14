import os
from flask import Flask, send_from_directory, abort

app = Flask(__name__)

# Define the directory where files are stored
DOWNLOAD_FOLDER = 'downloads'

@app.route('/download/<filename>')
def download_file(filename):
    # Ensure the filename does not contain path traversal sequences
    if '..' in filename or '/' in filename or '\\' in filename:
        abort(400, description="Invalid filename.")
    
    try:
        return send_from_directory(DOWNLOAD_FOLDER, filename, as_attachment=True)
    except FileNotFoundError:
        abort(404, description="File not found.")

if __name__ == '__main__':
    # Create the download folder if it doesn't exist
    os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)
    app.run(debug=True)