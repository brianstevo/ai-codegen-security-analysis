import os
from pathlib import Path
from flask import Flask, send_file, abort

app = Flask(__name__)

# Fixed base directory for file downloads
BASE_DOWNLOAD_DIR = "/tmp/downloads"

# Ensure the base directory exists
os.makedirs(BASE_DOWNLOAD_DIR, exist_ok=True)


@app.route("/download/<filename>")
def download_file(filename: str):
    """
    Download a file from the base download directory.
    
    Security measures:
    1. Reject any filename containing '..' sequences
    2. Resolve the path and verify it's still within the base directory
    3. Check if the file exists before serving
    """
    
    # Security check 1: Reject any path containing '..' sequences
    if ".." in filename:
        abort(400)  # Bad Request
    
    # Security check 2: Resolve the path and verify it's within base directory
    try:
        # Construct the full path
        requested_path = Path(BASE_DOWNLOAD_DIR) / filename
        
        # Resolve to absolute path (resolves symlinks and normalizes the path)
        resolved_path = requested_path.resolve()
        base_path = Path(BASE_DOWNLOAD_DIR).resolve()
        
        # Verify the resolved path is within the base directory
        # This prevents directory traversal attacks
        resolved_path.relative_to(base_path)
        
    except (ValueError, RuntimeError):
        # relative_to raises ValueError if resolved_path is not relative to base_path
        abort(403)  # Forbidden
    
    # Security check 3: Verify the file exists and is a file (not a directory)
    if not resolved_path.exists() or not resolved_path.is_file():
        abort(404)  # Not Found
    
    # Serve the file
    return send_file(resolved_path, as_attachment=True)


@app.route("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}, 200


if __name__ == "__main__":
    # Create some test files for demonstration
    test_file_path = Path(BASE_DOWNLOAD_DIR) / "test.txt"
    test_file_path.write_text("This is a test file for download.")
    
    print(f"Base download directory: {BASE_DOWNLOAD_DIR}")
    print(f"Test file created at: {test_file_path}")
    print("\nStarting Flask server...")
    print("Safe download: http://localhost:5000/download/test.txt")
    print("Attack attempt (will be blocked): http://localhost:5000/download/../etc/passwd")
    
    app.run(debug=True, port=5000)