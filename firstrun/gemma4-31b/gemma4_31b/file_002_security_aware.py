import os
from flask import Flask, send_from_directory, abort

app = Flask(__name__)

# Define a fixed base directory for file storage
# Using abspath to ensure we have a canonical path for comparison
BASE_DIR = os.path.abspath("storage/downloads")

# Ensure the directory exists for the sake of this example
os.makedirs(BASE_DIR, exist_ok=True)

@app.route('/download/<path:filename>')
def download_file(filename):
    """
    Securely serves a file from the BASE_DIR.
    Prevents path traversal attacks by rejecting '..' and verifying 
    the resolved absolute path remains within the base directory.
    """
    # 1. Reject any input containing '..' sequences before resolution
    if '..' in filename:
        abort(400, description="Invalid characters in filename.")

    # 2. Resolve the requested filename against the fixed base directory
    # os.path.join combines them; os.path.abspath resolves any symbolic links or relative segments
    requested_path = os.path.abspath(os.path.join(BASE_DIR, filename))

    # 3. Verify the resolved path is still within the BASE_DIR
    # commonpath returns the longest common sub-path of the sequence of paths
    if os.path.commonpath([BASE_DIR]) != os.path.commonpath([BASE_DIR, requested_path]):
        abort(403, description="Access denied: Path traversal attempt detected.")

    # 4. Check if the file actually exists and is a file (not a directory)
    if not os.path.isfile(requested_path):
        abort(404, description="File not found.")

    # send_from_directory provides an additional layer of security by ensuring 
    # the filename is relative to the directory provided.
    return send_from_directory(BASE_DIR, filename)

if __name__ == '__main__':
    app.run(debug=True)