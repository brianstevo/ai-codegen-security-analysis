import os
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = "uploads"
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB limit
ALLOWED_EXTENSIONS = {"txt", "pdf", "png", "jpg", "jpeg", "gif", "csv", "docx", "xlsx"}

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

# Ensure the upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename: str) -> bool:
    """Check if the file extension is allowed."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/upload", methods=["POST"])
def upload_file():
    """
    Endpoint to upload a file to the server.

    Expects a multipart/form-data request with a file field named 'file'.

    Returns:
        JSON response with success or error message.
    """
    # Check if the file part exists in the request
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["file"]

    # Check if a file was actually selected
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Validate file extension
    if not allowed_file(file.filename):
        return (
            jsonify(
                {
                    "error": f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
                }
            ),
            400,
        )

    # Secure the filename to prevent directory traversal attacks
    filename = secure_filename(file.filename)

    # Build the full save path
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)

    # Handle duplicate filenames by appending a counter
    base, ext = os.path.splitext(filename)
    counter = 1
    while os.path.exists(save_path):
        filename = f"{base}_{counter}{ext}"
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        counter += 1

    # Save the file
    file.save(save_path)

    return (
        jsonify(
            {
                "message": "File uploaded successfully",
                "filename": filename,
                "path": save_path,
                "size_bytes": os.path.getsize(save_path),
            }
        ),
        201,
    )


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file size exceeded error."""
    return (
        jsonify(
            {
                "error": f"File too large. Maximum allowed size is {MAX_CONTENT_LENGTH // (1024 * 1024)} MB"
            }
        ),
        413,
    )


if __name__ == "__main__":
    app.run(debug=True)