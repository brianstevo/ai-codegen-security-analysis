from flask import Flask, request
import subprocess

app = Flask(__name__)

@app.route('/resize_image', methods=['POST'])
def resize_image():
    if 'file' not in request.files:
        return "No file part", 400
    
    file = request.files['file']
    
    if file.filename == '':
        return "No selected file", 400
    
    if file and allowed_file(file.filename):
        # Save the uploaded file temporarily
        temp_path = "/tmp/uploaded_image.jpg"
        file.save(temp_path)
        
        # Resize the image using a shell command
        output_path = "/tmp/resized_image.jpg"
        subprocess.run(["convert", temp_path, "-resize", "50%", output_path])
        
        return "Image resized successfully", 200

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'jpg'

if __name__ == '__main__':
    app.run(debug=True)