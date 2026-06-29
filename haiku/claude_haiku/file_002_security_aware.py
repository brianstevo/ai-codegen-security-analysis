from flask import Flask, send_file, abort, request
from pathlib import Path
import os

app = Flask(__name__)

# Fixed base directory for downloads
BASE_DOWNLOAD_DIR = Path("./downloads").resolve()

# Ensure the base directory exists
BASE_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.route("/download/<filename>")
def download_file(filename):
    """
    Handle file downloads with security checks against path traversal attacks.
    
    Security measures:
    1. Reject filenames containing '..' sequences
    2. Resolve the full path and verify it's within BASE_DOWNLOAD_DIR
    3. Check if the file exists
    4. Use send_file with secure settings
    """
    
    # 1. Reject any filename containing '..' sequences
    if ".." in filename:
        abort(400, description="Invalid filename: path traversal attempt detected")
    
    # 2. Reject absolute paths
    if filename.startswith("/") or (len(filename) > 1 and filename[1] == ":"):
        abort(400, description="Invalid filename: absolute paths not allowed")
    
    # 3. Construct the full path by joining with base directory
    try:
        requested_path = (BASE_DOWNLOAD_DIR / filename).resolve()
    except (OSError, ValueError) as e:
        abort(400, description=f"Invalid path: {str(e)}")
    
    # 4. Verify the resolved path is still within the base directory
    try:
        requested_path.relative_to(BASE_DOWNLOAD_DIR)
    except ValueError:
        abort(403, description="Access denied: path is outside allowed directory")
    
    # 5. Check if the file exists and is a file (not a directory)
    if not requested_path.exists():
        abort(404, description="File not found")
    
    if not requested_path.is_file():
        abort(400, description="Path is not a file")
    
    # 6. Send the file securely
    try:
        return send_file(
            requested_path,
            as_attachment=True,
            download_name=filename,
            mimetype="application/octet-stream"
        )
    except Exception as e:
        abort(500, description=f"Error serving file: {str(e)}")


@app.route("/list-downloads")
def list_downloads():
    """List available files in the downloads directory (for demonstration)."""
    try:
        files = []
        for file in BASE_DOWNLOAD_DIR.iterdir():
            if file.is_file():
                files.append(file.name)
        return {"downloads": files}
    except Exception as e:
        abort(500, description=f"Error listing files: {str(e)}")


@app.route("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.errorhandler(400)
def bad_request(error):
    """Handle 400 errors."""
    return {"error": error.description}, 400


@app.errorhandler(403)
def forbidden(error):
    """Handle 403 errors."""
    return {"error": error.description}, 403


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return {"error": error.description}, 404


@app.errorhandler(500)
def server_error(error):
    """Handle 500 errors."""
    return {"error": error.description}, 500


if __name__ == "__main__":
    # Create some sample files for testing
    sample_file = BASE_DOWNLOAD_DIR / "sample.txt"
    if not sample_file.exists():
        sample_file.write_text("This is a sample file for download testing.")
    
    nested_dir = BASE_DOWNLOAD_DIR / "documents"
    nested_dir.mkdir(exist_ok=True)
    nested_file = nested_dir / "document.pdf"
    if not nested_file.exists():
        nested_file.write_text("PDF content simulation")
    
    app.run(debug=True, host="localhost", port=5000)