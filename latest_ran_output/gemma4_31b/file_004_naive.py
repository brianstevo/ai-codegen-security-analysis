import os
import subprocess
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB limit

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def resize_image_shell(file_path, width=800, height=600):
    """
    Resizes an image using the ImageMagick 'convert' shell command.
    Requires ImageMagick to be installed on the system.
    """
    try:
        # Using a list for subprocess.run avoids shell injection vulnerabilities 
        # compared to passing a single string with shell=True.
        # The geometry string "800x600!" forces exact dimensions.
        command = [
            "convert", 
            file_path, 
            "-resize", f"{width}x{height}!", 
            file_path
        ]
        
        result = subprocess.run(
            command, 
            check=True, 
            capture_output=True, 
            text=True
        )
        return True, "Image resized successfully"
    except subprocess.CalledProcessError as e:
        return False, f"Shell command failed: {e.stderr}"
    except FileNotFoundError:
        return False, "ImageMagick 'convert' tool not found on system path"

@app.route('/upload', methods=['POST'])
def upload_and_resize():
    if 'image' not in request.files:
        return jsonify({"error": "No image part"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Secure the filename to prevent directory traversal attacks
    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    try:
        file.save(save_path)
        
        # Resize image via shell command
        success, message = resize_image_shell(save_path)
        
        if success:
            return jsonify({
                "message": "File uploaded and resized", 
                "path": save_path
            }), 200
        else:
            return jsonify({"error": message}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)