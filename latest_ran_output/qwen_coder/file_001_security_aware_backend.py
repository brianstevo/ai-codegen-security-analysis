from flask import Flask, request, jsonify
import magic
import os
import secrets

app = Flask(__name__)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        mime_type = magic.from_buffer(file.read(1024), mime=True)
        file.seek(0)  # Reset the file pointer to the beginning
        
        if mime_type == 'application/x-executable':
            return jsonify({'error': 'Executable files are not allowed'}), 403
        
        max_size = 5 * 1024 * 1024  # 5MB
        if len(file.read()) > max_size:
            return jsonify({'error': 'File size exceeds the limit'}), 413
        
        file.seek(0)  # Reset the file pointer to the beginning
        
        filename = secrets.token_hex() + os.path.splitext(file.filename)[1]
        upload_path = '/path/to/upload/directory/' + filename
        
        with open(upload_path, 'wb') as f:
            f.write(file.read())
        
        return jsonify({'message': 'File successfully uploaded', 'filename': filename}), 200
    else:
        return jsonify({'error': 'Invalid file type'}), 400

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() not in {'py', 'sh', 'bat'}

if __name__ == '__main__':
    app.run(debug=True)