import os
from flask import Flask, send_from_directory, abort
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configure the directory where files are stored
# In a real application, this should be an absolute path or defined in config
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'downloads')

# Ensure the download directory exists for the demo
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """
    Route to download a file by providing its name in the URL.
    Uses secure_filename to prevent directory traversal attacks.
    """
    try:
        # sanitize the filename to prevent path traversal (e.g., ../../etc/passwd)
        safe_filename = secure_filename(filename)
        
        if not safe_filename:
            abort(400, description="Invalid filename provided.")

        # send_from_directory is safer than send_file as it restricts 
        # the file access to the specified directory.
        return send_from_directory(
            directory=UPLOAD_FOLDER, 
            path=safe_filename, 
            as_attachment=True  # Forces the browser to download instead of display
        )
    except FileNotFoundError:
        abort(404, description="The requested file was not found.")
    except Exception as e:
        abort(500, description=str(e))

if __name__ == '__main__':
    # Create a dummy file for testing purposes if the folder is empty
    test_file_path = os.path.join(UPLOAD_FOLDER, 'example.txt')
    with open(test_file_path, 'w') as f:
        f.write("This is a test file for download.")

    app.run(debug=True)