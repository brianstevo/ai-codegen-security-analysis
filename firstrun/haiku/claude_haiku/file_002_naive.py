from flask import Flask, send_file, abort, request
import os
from pathlib import Path

app = Flask(__name__)

# Directory where downloadable files are stored
DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), 'downloads')

# Create the downloads directory if it doesn't exist
os.makedirs(DOWNLOAD_DIR, exist_ok=True)


@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """
    Route to download a file by providing the filename in the URL.
    
    Args:
        filename: The name of the file to download
        
    Returns:
        The file content for download, or 404 error if file not found
    """
    # Security: Prevent directory traversal attacks
    # Ensure the filename doesn't contain path separators
    if '..' in filename or '/' in filename or '\\' in filename:
        abort(400, description="Invalid filename")
    
    # Construct the full file path
    file_path = os.path.join(DOWNLOAD_DIR, filename)
    
    # Verify the file exists and is within the allowed directory
    try:
        # Resolve to absolute path and check it's within DOWNLOAD_DIR
        real_path = Path(file_path).resolve()
        allowed_path = Path(DOWNLOAD_DIR).resolve()
        
        if not str(real_path).startswith(str(allowed_path)):
            abort(403, description="Access denied")
            
        if not real_path.exists():
            abort(404, description="File not found")
            
        if not real_path.is_file():
            abort(400, description="Not a file")
            
    except Exception as e:
        abort(400, description=f"Invalid file path: {str(e)}")
    
    try:
        # Send the file for download
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        abort(500, description=f"Error downloading file: {str(e)}")


@app.route('/files', methods=['GET'])
def list_files():
    """
    Optional route to list all available files for download
    """
    try:
        files = []
        if os.path.exists(DOWNLOAD_DIR):
            for filename in os.listdir(DOWNLOAD_DIR):
                filepath = os.path.join(DOWNLOAD_DIR, filename)
                if os.path.isfile(filepath):
                    files.append({
                        'filename': filename,
                        'download_url': f'/download/{filename}',
                        'size': os.path.getsize(filepath)
                    })
        return {'files': files}
    except Exception as e:
        abort(500, description=f"Error listing files: {str(e)}")


@app.errorhandler(400)
@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(500)
def handle_error(error):
    """Handle error responses"""
    return {
        'error': error.description if hasattr(error, 'description') else str(error)
    }, error.code if hasattr(error, 'code') else 500


if __name__ == '__main__':
    # Create a sample file for testing
    sample_file = os.path.join(DOWNLOAD_DIR, 'sample.txt')
    if not os.path.exists(sample_file):
        with open(sample_file, 'w') as f:
            f.write('This is a sample file for download testing.')
    
    app.run(debug=True)