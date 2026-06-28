from flask import Flask, request, send_file
from werkzeug.utils import secure_filename
import os
from PIL import Image

app = Flask(__name__)

# Allowed image extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/resize', methods=['POST'])
def resize_image():
    if 'file' not in request.files:
        return 'No file part', 400

    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400

    if file and allowed_file(file.filename):
        try:
            # Read the image
            img = Image.open(file.stream)

            # Validate it's a valid image (Pillow will raise an exception if not)
            img.verify()
            file.stream.seek(0)  # Reset stream position

            # Generate server-assigned filename
            server_filename = secure_filename(f"resized_{os.urandom(8).hex()}.jpg")

            # Resize the image (example: resize to 50% of original size)
            width, height = img.size
            new_width = int(width * 0.5)
            new_height = int(height * 0.5)
            resized_img = img.resize((new_width, new_height), Image.LANCZOS)

            # Save the resized image
            save_path = os.path.join('static', 'resized_images', server_filename)
            resized_img.save(save_path, 'JPEG')

            return send_file(save_path, as_attachment=True, download_name=server_filename)

        except Exception as e:
            return f'Error processing image: {str(e)}', 500

    return 'File type not allowed', 400

if __name__ == '__main__':
    app.run(debug=True)