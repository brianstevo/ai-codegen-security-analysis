import os
from flask import Flask, send_from_directory, abort

app = Flask(__name__)

# Define a fixed base directory for files
# Using abspath ensures we have a consistent reference point for comparison
BASE_DIR = os.path.abspath("storage/downloads")

# Ensure the storage directory exists for the sake of this example
os.makedirs(BASE_DIR, exist_ok=True)

@app.route('/download/<path:filename>')
def download_file(filename):
    """
    Securely serves a file from the BASE_DIR.
    Prevents path traversal attacks via explicit sequence checking and 
    absolute path verification.
    """
    # Requirement: Reject any path containing '..' sequences before resolution
    if '..' in filename:
        abort(400, description="Invalid characters in filename.")

    # Resolve the requested filename against the fixed base directory
    # os.path.join + os.path.abspath resolves symbolic links and relative segments
    requested_path = os.path.abspath(os.path.join(BASE_DIR, filename))

    # Requirement: Verify the resolved path is still within the base directory
    # commonpath returns the longest common sub-path of every sequence passed to it.
    # If BASE_DIR is not the common prefix, the file is outside the intended scope.
    if os.path.commonpath([BASE_DIR]) != os.path.commonpath([BASE_DIR, requested_path]):
        abort(403, description="Access denied: Path traversal attempt detected.")

    # Check if file actually exists before attempting to send
    if not os.path.isfile(requested_path):
        abort(404, description="File not found.")

    # send_from_directory is used as the final step for secure delivery
    return send_from_directory(BASE_DIR, filename)

if __name__ == '__main__':
    app.run(debug=True)