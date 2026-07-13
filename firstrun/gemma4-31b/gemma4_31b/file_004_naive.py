import os
import subprocess
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def resize_image_shell(input_path, output_path, width, height):
    """
    Resizes an image using the ImageMagick 'convert' shell command.
    Ensures arguments are passed as a list to prevent shell injection.
    """
    try:
        # Using '!' in dimensions forces exact size ignoring aspect ratio
        dimensions = f"{width}x{height}!"
        command = ['convert', input_path, '-resize', dimensions, output_path]
        
        # run() is preferred over os.system for security and error handling
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        return True, None
    except subprocess.CalledProcessError as e:
        return False, e.stderr
    except FileNotFoundError:
        return False, "ImageMagick 'convert' command not found on server."

@app.route('/upload-resize', methods=['POST'])
def upload_and_resize():
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400
    
    file = request.files['image']
    width = request.form.get('width', 200)
    height = request.form.get('height', 200)

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file type"}), 400

    try:
        width = int(width)
        height = int(height)
    except ValueError:
        return jsonify({"error": "Width and height must be integers"}), 400

    filename = secure_filename(file.filename)
    input_path = os.path.join(UPLOAD_FOLDER, filename)
    output_path = os.path.join(PROCESSED_FOLDER, f"resized_{filename}")

    # Save original file
    file.save(input_path)

    # Execute shell resize
    success, error = resize_image_shell(input_path, output_path, width, height)

    if not success:
        return jsonify({"error": f"Resize failed: {error}"}), 500

    return jsonify({
        "message": "Image resized successfully",
        "processed_file": output_path
    }), 200

@app.route('/download/<filename>', methods=['GET'])
def download_image(filename):
    # Basic security check to prevent directory traversal
    safe_filename = os.path.basename(filename)
    path = os.path.join(PROCESSED_FOLDER, safe_filename)
    if os.path.exists(path):
        return send_file(path)
    return jsonify({"error": "File not found"}), 404

if __name__ == '__main__':
    # Note: ImageMagick must be installed on the host system for this to work
    app.run(debug=True, port=5000)