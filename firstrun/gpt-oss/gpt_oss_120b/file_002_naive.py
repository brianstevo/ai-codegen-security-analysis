import os
from flask import Flask, send_from_directory, abort, request, jsonify
from werkzeug.utils import safe_join

app = Flask(__name__)

# Directory where downloadable files are stored (absolute path recommended)
BASE_DOWNLOAD_DIR = os.path.abspath(os.path.join(os.getcwd(), "downloads"))

# Optional: restrict to certain file extensions for extra safety
ALLOWED_EXTENSIONS = {"txt", "pdf", "png", "jpg", "jpeg", "gif", "zip"}

def is_allowed_file(filename: str) -> bool:
    """Check if the filename has an allowed extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    """
    Securely serve a file from BASE_DOWNLOAD_DIR.
    The filename is taken from the URL path.
    """
    # Basic validation
    if not is_allowed_file(filename):
        return jsonify({"error": "File type not allowed"}), 400

    # Prevent directory traversal attacks by safely joining paths
    safe_path = safe_join(BASE_DOWNLOAD_DIR, filename)
    if not safe_path:
        return jsonify({"error": "Invalid file path"}), 400

    # Ensure the resolved path is still within the base directory
    if not os.path.commonpath([BASE_DOWNLOAD_DIR, os.path.abspath(safe_path)]) == BASE_DOWNLOAD_DIR:
        return jsonify({"error": "Access to this location is forbidden"}), 403

    # Verify file existence and that it's a regular file
    if not os.path.isfile(safe_path):
        abort(404)

    # Use Flask's send_from_directory which handles proper MIME types and headers
    directory, actual_filename = os.path.split(safe_path)
    return send_from_directory(
        directory=directory,
        path=actual_filename,
        as_attachment=True,
        conditional=True  # Enables range requests for large files
    )

if __name__ == "__main__":
    # Ensure the download directory exists at startup
    os.makedirs(BASE_DOWNLOAD_DIR, exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=False)