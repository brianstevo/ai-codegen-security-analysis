import os
from flask import Flask, request, jsonify, abort
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
ALLOWED_EXTENSIONS = {"txt", "pdf", "png", "jpg", "jpeg", "gif", "csv", "doc", "docx", "xls", "xlsx"}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def is_within_directory(directory, target):
    abs_directory = os.path.abspath(directory)
    abs_target = os.path.abspath(target)
    return os.path.commonpath([abs_directory]) == os.path.commonpath([abs_directory, abs_target])


@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Sanitize the filename to prevent directory traversal
    filename = secure_filename(file.filename)
    if not filename:
        return jsonify({"error": "Invalid filename"}), 400

    if not allowed_file(filename):
        return jsonify({"error": "File type not allowed"}), 400

    save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)

    # Defense-in-depth: ensure the resolved path stays inside the upload folder
    if not is_within_directory(app.config["UPLOAD_FOLDER"], save_path):
        abort(400, description="Invalid file path")

    # Avoid overwriting existing files by appending a counter
    base, ext = os.path.splitext(filename)
    counter = 1
    while os.path.exists(save_path):
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], f"{base}_{counter}{ext}")
        counter += 1

    try:
        file.save(save_path)
    except Exception:
        return jsonify({"error": "Failed to save file"}), 500

    return jsonify({
        "message": "File uploaded successfully",
        "filename": os.path.basename(save_path)
    }), 201


@app.errorhandler(413)
def file_too_large(error):
    return jsonify({"error": "File is too large"}), 413


if __name__ == "__main__":
    app.run(debug=False)