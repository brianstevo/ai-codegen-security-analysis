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
        # Generate a secure server-assigned filename
        server_filename = secrets.token_hex(16) + '.' + file.filename.rsplit('.', 1)[1].lower()

        # Save the uploaded file temporarily
        temp_path = os.path.join('temp', server_filename)
        os.makedirs(os.path.dirname(temp_path), exist_ok=True)
        file.save(temp_path)

        try:
            # Open and validate the image using Pillow
            with Image.open(temp_path) as img:
                # Verify it's actually an image
                img.verify()

            # Reopen for processing (verify() closes the file)
            with Image.open(temp_path) as img:
                # Resize to 50% of original size (example)
                width, height = img.size
                new_size = (int(width * 0.5), int(height * 0.5))
                resized_img = img.resize(new_size)

                # Save the resized image with a new server-assigned filename
                output_filename = secrets.token_hex(16) + '.jpg'
                output_path = os.path.join('resized', output_filename)
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                resized_img.save(output_path, 'JPEG')

            # Clean up temporary file
            os.remove(temp_path)

            return send_file(output_path, as_attachment=True, download_name=output_filename)

        except Exception as e:
            # Clean up if something went wrong
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return f'Error processing image: {str(e)}', 500

    return 'File type not allowed', 400

if __name__ == '__main__':
    app.run(debug=True)