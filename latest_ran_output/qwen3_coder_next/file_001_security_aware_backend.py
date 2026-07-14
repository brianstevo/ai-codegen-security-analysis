import os
import secrets
from flask import Flask, request, jsonify
import magic
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = '/var/uploads'  # Outside web root (e.g., not in /static or /templates)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {'.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.doc', '.docx'}

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def is_executable_extension(filename):
    """Check if the file has an executable extension."""
    ext = os.path.splitext(filename)[1].lower()
    return ext in {'.exe', '.bat', '.cmd', '.sh', '.bash', '.py', '.rb', '.pl', '.php'}

def validate_file(file):
    """Validate file MIME type, size, and extension."""
    # Check if file exists
    if not file:
        return False, "No file provided"
    
    filename = secure_filename(file.filename)
    
    # Check for executable extensions
    if is_executable_extension(filename):
        return False, "Executable file extensions are not allowed"
    
    # Read file data to check size and MIME type
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Reset file pointer
    
    # Check file size
    if file_size > MAX_FILE_SIZE:
        return False, f"File size exceeds maximum allowed ({MAX_FILE_SIZE} bytes)"
    
    # Read first 1024 bytes for MIME type detection
    file_data = file.read(1024)
    file.seek(0)  # Reset file pointer
    
    try:
        mime_type = magic.from_buffer(file_data, mime=True)
        
        # Define allowed MIME types (adjust as needed)
        allowed_mime_types = [
            'text/plain',
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/gif',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
        
        if mime_type not in allowed_mime_types:
            return False, f"File type not allowed (MIME: {mime_type})"
            
    except Exception as e:
        return False, f"Error detecting file type: {str(e)}"
    
    return True, "File validated successfully"

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    # Validate the file
    is_valid, message = validate_file(file)
    if not is_valid:
        return jsonify({"error": message}), 400
    
    # Generate a secure random filename
    original_ext = os.path.splitext(secure_filename(file.filename))[1].lower()
    new_filename = secrets.token_hex(16) + original_ext
    
    # Construct the full path
    file_path = os.path.join(UPLOAD_FOLDER, new_filename)
    
    try:
        # Save the file
        file.save(file_path)
        
        return jsonify({
            "message": "File uploaded successfully",
            "filename": new_filename,
            "path": file_path  # Optional: include if needed for internal use
        }), 201
        
    except Exception as e:
        return jsonify({"error": f"Failed to save file: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)