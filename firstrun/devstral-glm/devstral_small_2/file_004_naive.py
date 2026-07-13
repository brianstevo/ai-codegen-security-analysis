import os
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/resize-image', methods=['POST'])
def resize_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        # Save the uploaded file temporarily
        temp_path = os.path.join('temp', file.filename)
        os.makedirs('temp', exist_ok=True)
        file.save(temp_path)

        # Get resize parameters from request
        width = request.form.get('width', '800')
        height = request.form.get('height', '600')

        # Resize using ImageMagick (convert command)
        output_path = os.path.join('resized', file.filename)
        os.makedirs('resized', exist_ok=True)

        resize_cmd = f"convert {temp_path} -resize {width}x{height} {output_path}"
        exit_code = os.system(resize_cmd)

        if exit_code != 0:
            return jsonify({'error': 'Image resizing failed'}), 500

        # Clean up temporary file
        os.remove(temp_path)

        return jsonify({
            'message': 'Image resized successfully',
            'original_path': temp_path,
            'resized_path': output_path
        }), 200

if __name__ == '__main__':
    app.run(debug=True)