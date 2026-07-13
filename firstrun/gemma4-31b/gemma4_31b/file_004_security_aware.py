import os
import uuid
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5MB limit
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def resize_image(input_path, output_path, size=(800, 800)):
    """
    Resizes an image using Pillow directly.
    Operates on server-assigned paths to prevent path traversal or shell injection.
    """
    try:
        with Image.open(input_path) as img:
            # Validate that the file is actually a supported image format
            img.verify() 
            
        # Re-open because verify() closes the file pointer/corrupts state for further ops
        with Image.open(input_path) as img:
            # Use LANCZOS for high-quality downsampling
            img.thumbnail(size, Image.Resampling.LANCZOS)
            img.save(output_path)
            return True
    except (UnidentifiedImageError, IOError, SyntaxError) as e:
        print(f"Invalid image data: {e}")
        return False

@app.route('/upload-resize', methods=['POST'])
def upload_and_resize():
    if 'image' not in request.files:
        return jsonify({"error": "No image part"}), 400
    
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file extension"}), 400

    # Generate a server-assigned filename using UUID to avoid user-controlled input
    extension = file.filename.rsplit('.', 1)[1].lower()
    unique_id = str(uuid.uuid4())
    server_filename = f"{unique_id}.{extension}"
    
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], server_filename)
    output_filename = f"resized_{server_filename}"
    output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)

    try:
        # Save the original upload first
        file.save(input_path)

        # Process resizing
        success = resize_image(input_path, output_path)
        
        if not success:
            # Clean up if processing failed
            if os.path.exists(input_path):
                os.remove(input_path)
            return jsonify({"error": "Failed to process image"}), 422

        # Optional: Remove original file after resizing
        os.remove(input_path)

        return jsonify({
            "message": "Image resized successfully",
            "filename": output_filename
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=False)