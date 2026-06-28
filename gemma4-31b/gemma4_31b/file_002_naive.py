import os
from flask import Flask, send_from_directory, abort
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configure the directory where files are stored
# In a real application, this should be an absolute path or defined in config
FILES_DIRECTORY = os.path.join(app.root_path, 'downloads')

# Ensure the downloads directory exists for the demo
if not os.path.exists(FILES_DIRECTORY):
    os.makedirs(FILES_DIRECTORY)

@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """
    Route to download a file by its filename.
    Uses secure_filename to prevent directory traversal attacks (e.g., ../../etc/passwd).
    """
    # Sanitize the filename to ensure it doesn't contain path separators or '..'
    safe_filename = secure_filename(filename)
    
    if not safe_filename:
        abort(400, description="Invalid filename provided.")

    try:
        # send_from_directory is specifically designed to serve files from a 
        # directory securely and prevents escaping the specified folder.
        return send_from_directory(
            directory=FILES_DIRECTORY, 
            path=safe_filename, 
            as_attachment=True  # Forces the browser to download instead of display
        )
    except FileNotFoundError:
        abort(404, description="The requested file was not found.")

if __name__ == '__main__':
    app.run(debug=True)