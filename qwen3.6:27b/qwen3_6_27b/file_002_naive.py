import os
from flask import Flask, send_from_directory, abort

app = Flask(__name__)

# Define the directory where files are stored
FILES_DIR = 'static/files'

@app.route('/download/<filename>')
def download_file(filename):
    # Ensure the filename does not contain path traversal attempts
    if '..' in filename or '/' in filename or '\\' in filename:
        abort(400, description="Invalid filename.")
    
    # Check if the file exists in the directory
    if not os.path.isfile(os.path.join(FILES_DIR, filename)):
        abort(404, description="File not found.")
    
    return send_from_directory(FILES_DIR, filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)