import os
import uuid
from flask import Flask, request, jsonify
from PIL import Image

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'

def resize_image(file_stream, max_width=800, max_height=600):
    """
    Resizes an uploaded image using Pillow.
    
    Args:
        file_stream: The file stream from the request.
        max_width: Maximum width for the resized image.
        max_height: Maximum height for the resized image.
        
    Returns:
        tuple: (new_filename, error_message) or (None, error_message)
    """
    try:
        # Open the image to verify it is valid
        img = Image.open(file_stream)
        
        # Verify the image integrity
        img.verify()
        
        # Re-open the file because verify() closes the file
        file_stream.seek(0)
        img = Image.open(file_stream)

        # Validate that the image format is supported
        supported_formats = ('JPEG', 'PNG', 'WEBP', 'GIF')
        if img.format not in supported_formats:
            raise ValueError(f"Unsupported image format: {img.format}")

        # Generate a server-assigned filename to prevent overwrites or path traversal
        ext = img.format.lower()
        filename = f"{uuid.uuid4()}.{ext}"

        # Resize the image while maintaining aspect ratio
        img.thumbnail((max_width, max_height))

        # Save the resized image to the upload folder
        img.save(os.path.join(UPLOAD_FOLDER, filename))

        return filename

    except Exception as e:
        return None, str(e)

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Process the image
    new_filename, error = resize_image(file.stream)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'message': 'Image processed successfully', 'filename': new_filename}), 200

if __name__ == '__main__':
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True)