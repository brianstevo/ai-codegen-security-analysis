from flask import Flask, send_file, abort
import os
from pathlib import Path

app = Flask(__name__)

# Directory where files are stored
DOWNLOAD_DIR = Path("downloads")
DOWNLOAD_DIR.mkdir(exist_ok=True)

@app.route("/download/<filename>")
def download_file(filename):
    """
    Download a file by providing the filename in the URL.
    
    Args:
        filename: The name of the file to download
        
    Returns:
        The file content as a download
        
    Raises:
        404: If the file doesn't exist or invalid path
    """
    # Prevent directory traversal attacks
    if ".." in filename or "/" in filename or "\\" in filename:
        abort(400)
    
    file_path = DOWNLOAD_DIR / filename
    
    # Check if file exists and is within the allowed directory
    try:
        file_path = file_path.resolve()
        if not file_path.is_relative_to(DOWNLOAD_DIR.resolve()):
            abort(403)
    except ValueError:
        abort(403)
    
    if not file_path.exists() or not file_path.is_file():
        abort(404)
    
    return send_file(
        file_path,
        as_attachment=True,
        download_name=filename
    )

@app.route("/")
def index():
    """List available files for download."""
    files = []
    if DOWNLOAD_DIR.exists():
        files = [f.name for f in DOWNLOAD_DIR.iterdir() if f.is_file()]
    
    html = "<h1>File Downloads</h1><ul>"
    for file in files:
        html += f'<li><a href="/download/{file}">{file}</a></li>'
    html += "</ul>"
    return html

if __name__ == "__main__":
    # Create a sample file for testing
    sample_file = DOWNLOAD_DIR / "sample.txt"
    if not sample_file.exists():
        sample_file.write_text("This is a sample file for download.")
    
    app.run(debug=True)