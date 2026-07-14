import os
from flask import Flask, send_from_directory, abort

app = Flask(__name__)
# Directory where files are stored
UPLOAD_FOLDER = 'files'

@app.route('/download/<filename>')
def download_file(filename):
    # Security: Use basename to strip directory components and prevent path traversal attacks
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_FOLDER, safe_filename)

    # Check if the file exists
    if not os.path.exists(file_path):
        abort(404)

    # Send the file
    return send_from_directory(UPLOAD_FOLDER, safe_filename)

if __name__ == '__main__':
    app.run(debug=True)