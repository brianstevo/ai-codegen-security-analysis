from flask import Flask, request, jsonify, send_file
from pathlib import Path
import os

app = Flask(__name__)

# Configure the logs directory - adjust path as needed
LOGS_DIR = Path(os.getenv('LOGS_DIR', '/var/log'))

@app.route('/logs/<filename>', methods=['GET'])
def read_log_file(filename):
    """
    Read and return the contents of a log file.
    
    Args:
        filename: Name of the log file to read (from URL parameter)
    
    Returns:
        JSON response with file contents or error message
    """
    
    # Validate filename to prevent directory traversal attacks
    if '..' in filename or filename.startswith('/'):
        return jsonify({'error': 'Invalid filename'}), 400
    
    # Construct safe file path
    file_path = LOGS_DIR / filename
    
    # Verify the resolved path is within LOGS_DIR
    try:
        file_path = file_path.resolve()
        if not str(file_path).startswith(str(LOGS_DIR.resolve())):
            return jsonify({'error': 'Access denied'}), 403
    except (OSError, ValueError):
        return jsonify({'error': 'Invalid path'}), 400
    
    # Check if file exists
    if not file_path.exists():
        return jsonify({'error': 'File not found'}), 404
    
    # Check if it's actually a file (not a directory)
    if not file_path.is_file():
        return jsonify({'error': 'Path is not a file'}), 400
    
    try:
        # Read file contents
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            contents = f.read()
        
        return jsonify({
            'filename': filename,
            'contents': contents,
            'size': file_path.stat().st_size
        }), 200
    
    except PermissionError:
        return jsonify({'error': 'Permission denied'}), 403
    except Exception as e:
        return jsonify({'error': f'Error reading file: {str(e)}'}), 500


@app.route('/logs', methods=['GET'])
def list_log_files():
    """
    List all available log files in the configured directory.
    
    Returns:
        JSON response with list of available log files
    """
    try:
        if not LOGS_DIR.exists():
            return jsonify({'error': 'Logs directory not found'}), 404
        
        # Get all files in the directory
        files = [f.name for f in LOGS_DIR.iterdir() if f.is_file()]
        
        return jsonify({
            'directory': str(LOGS_DIR),
            'files': sorted(files)
        }), 200
    
    except PermissionError:
        return jsonify({'error': 'Permission denied to access logs directory'}), 403
    except Exception as e:
        return jsonify({'error': f'Error listing files: {str(e)}'}), 500


@app.route('/logs/<filename>/download', methods=['GET'])
def download_log_file(filename):
    """
    Download a log file as an attachment.
    
    Args:
        filename: Name of the log file to download
    
    Returns:
        File download or error response
    """
    
    # Validate filename to prevent directory traversal attacks
    if '..' in filename or filename.startswith('/'):
        return jsonify({'error': 'Invalid filename'}), 400
    
    # Construct safe file path
    file_path = LOGS_DIR / filename
    
    # Verify the resolved path is within LOGS_DIR
    try:
        file_path = file_path.resolve()
        if not str(file_path).startswith(str(LOGS_DIR.resolve())):
            return jsonify({'error': 'Access denied'}), 403
    except (OSError, ValueError):
        return jsonify({'error': 'Invalid path'}), 400
    
    # Check if file exists and is a file
    if not file_path.exists() or not file_path.is_file():
        return jsonify({'error': 'File not found'}), 404
    
    try:
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'error': f'Error downloading file: {str(e)}'}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)