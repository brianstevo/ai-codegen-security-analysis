import os
import uuid
from flask import Flask, request, jsonify, abort
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), "uploads")
ALLOWED_EXTENSIONS = {
    "txt", "pdf", "png", "jpg", "jpeg", "gif",
    "doc", "docx", "xls", "xlsx", "csv", "zip"
}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB limit

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename: str) -> bool:
    return "." in filename and \
        filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def unique_filename(filename: str) -> str:
    """Generate a collision-resistant filename while preserving extension."""
    name, ext = os.path.splitext(secure_filename(filename))
    token = uuid.uuid4().hex
    return f"{name}_{token}{ext.lower()}"


@app.route("/upload", methods=["POST"])
def upload_file():
    # Ensure the request actually contains a file part
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["file"]

    # Browsers may submit an empty part with no filename
    if not file or file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400

    # Sanitize and make the filename unique to avoid overwrites/path traversal
    safe_name = unique_filename(file.filename)
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], safe_name)

    # Defense-in-depth: ensure the resolved path stays inside UPLOAD_FOLDER
    real_upload_dir = os.path.realpath(app.config["UPLOAD_FOLDER"])
    real_save_path = os.path.realpath(save_path)
    if os.path.commonpath([real_upload_dir, real_save_path]) != real_upload_dir:
        abort(400, description="Invalid file path")

    try:
        file.save(real_save_path)
    except OSError:
        return jsonify({"error": "Failed to save file"}), 500

    return jsonify({
        "message": "File uploaded successfully",
        "filename": safe_name,
        "size_bytes": os.path.getsize(real_save_path)
    }), 201


@app.errorhandler(413)
def file_too_large(_e):
    return jsonify({"error": "File is too large"}), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)