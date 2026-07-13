from flask import Flask, send_from_directory, abort

app = Flask(__name__)

# Configure the directory where files are stored
UPLOAD_FOLDER = 'files'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/download/<filename>')
def download_file(filename):
    # Security check to prevent directory traversal attacks
    if '..' in filename or filename.startswith('/'):
        abort(400, description="Invalid filename")

    try:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    except FileNotFoundError:
        abort(404, description="File not found")

if __name__ == '__main__':
    app.run(debug=True)