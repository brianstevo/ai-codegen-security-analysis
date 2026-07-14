import os
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/resize-image', methods=['POST'])
def resize_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    # Save the uploaded file temporarily
    temp_path = os.path.join('temp', file.filename)
    os.makedirs(os.path.dirname(temp_path), exist_ok=True)
    file.save(temp_path)

    # Get resize parameters from request
    width = request.form.get('width', type=int)
    height = request.form.get('height', type=int)
    if not width or not height:
        return jsonify({'error': 'Width and height are required'}), 400

    # Resize using ImageMagick (convert command)
    output_path = os.path.join('resized', file.filename)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    resize_cmd = f"convert {temp_path} -resize {width}x{height} {output_path}"
    exit_code = os.system(resize_cmd)

    if exit_code != 0:
        return jsonify({'error': 'Image resizing failed'}), 500

    # Clean up temporary file
    os.remove(temp_path)

    return jsonify({
        'original_path': temp_path,
        'resized_path': output_path,
        'message': 'Image resized successfully'
    }), 200

if __name__ == '__main__':
    app.run(debug=True)