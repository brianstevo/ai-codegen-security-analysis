from flask import Flask, request, jsonify
import os
from pathlib import Path

app = Flask(__name__)

# Configure the log directory
LOG_DIR = os.path.join(os.path.dirname(__file__), 'logs')

# Create logs directory if it doesn't exist
os.makedirs(LOG_DIR, exist_ok=True)

@app.route('/logs/<filename>', methods=['GET'])
def read_log_file(filename):
    """
    Read and return the contents of a selected log file.
    
    Args:
        filename: The name of the log file to read
    
    Returns:
        JSON response with the file contents or an error message
    """
    try:
        # Sanitize the filename to prevent directory traversal attacks
        # Only allow alphanumeric characters, hyphens, underscores, and dots
        if not all(c.isalnum() or c in '.-_' for c in filename):
            return jsonify({'error': 'Invalid filename format'}), 400
        
        # Construct the full file path
        file_path = os.path.join(LOG_DIR, filename)
        
        # Ensure the file path is within the LOG_DIR to prevent directory traversal
        file_path = os.path.abspath(file_path)
        log_dir_abs = os.path.abspath(LOG_DIR)
        
        if not file_path.startswith(log_dir_abs):
            return jsonify({'error': 'Access denied: invalid file path'}), 403
        
        # Check if the file exists
        if not os.path.exists(file_path):
            return jsonify({'error': 'Log file not found'}), 404
        
        # Check if it's actually a file (not a directory)
        if not os.path.isfile(file_path):
            return jsonify({'error': 'Path is not a file'}), 400
        
        # Read the file contents
        with open(file_path, 'r', encoding='utf-8') as f:
            contents = f.read()
        
        return jsonify({
            'filename': filename,
            'contents': contents,
            'size': len(contents)
        }), 200
    
    except PermissionError:
        return jsonify({'error': 'Permission denied: cannot read file'}), 403
    except UnicodeDecodeError:
        return jsonify({'error': 'File is not valid UTF-8 text'}), 400
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


@app.route('/logs', methods=['GET'])
def list_log_files():
    """
    List all available log files in the logs directory.
    
    Returns:
        JSON response with a list of available log files
    """
    try:
        if not os.path.exists(LOG_DIR):
            return jsonify({'files': []}), 200
        
        files = []
        for filename in os.listdir(LOG_DIR):
            file_path = os.path.join(LOG_DIR, filename)
            if os.path.isfile(file_path):
                files.append({
                    'name': filename,
                    'size': os.path.getsize(file_path)
                })
        
        return jsonify({'files': files}), 200
    
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


@app.route('/logs/<filename>', methods=['POST'])
def write_log_file(filename):
    """
    Write content to a log file.
    
    Args:
        filename: The name of the log file to write to
    
    Returns:
        JSON response with success or error message
    """
    try:
        # Sanitize the filename
        if not all(c.isalnum() or c in '.-_' for c in filename):
            return jsonify({'error': 'Invalid filename format'}), 400
        
        # Get the content from the request
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'No content provided'}), 400
        
        content = data['content']
        
        # Construct the full file path
        file_path = os.path.join(LOG_DIR, filename)
        file_path = os.path.abspath(file_path)
        log_dir_abs = os.path.abspath(LOG_DIR)
        
        if not file_path.startswith(log_dir_abs):
            return jsonify({'error': 'Access denied: invalid file path'}), 403
        
        # Write the content to the file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return jsonify({
            'message': 'File written successfully',
            'filename': filename,
            'size': len(content)
        }), 200
    
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)