from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os
from pathlib import Path

app = Flask(__name__)

# Configure upload directory
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / "uploads"
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

# Optional: restrict allowed file extensions
ALLOWED_EXTENSIONS = {"txt", "pdf", "png", "jpg", "jpeg", "gif", "csv", "zip"}

app.config["UPLOAD_FOLDER"] = str(UPLOAD_FOLDER)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20 MB max upload size


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/upload", methods=["POST"])
def upload_file():
    # Check if file part exists in request
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files["file"]

    # Handle empty filename
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Validate extension and save securely
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(save_path)
        return jsonify(
            {
                "message": "File uploaded successfully",
                "filename": filename,
                "path": save_path,
            }
        ), 201

    return jsonify({"error": "File type not allowed"}), 400


if __name__ == "__main__":
    app.run(debug=True)