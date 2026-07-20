from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os

app = Flask(__name__)

# Configure upload directory and max upload size (optional)
app.config["UPLOAD_FOLDER"] = os.path.join(os.getcwd(), "uploads")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB

# Ensure the upload directory exists
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

@app.route("/upload", methods=["POST"])
def upload_file():
    # Check if the request has the file part
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["file"]

    # If user does not select a file
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Save the file securely
    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(file_path)

    return jsonify({
        "message": "File uploaded successfully",
        "filename": filename,
        "path": file_path
    }), 201

if __name__ == "__main__":
    app.run(debug=True)