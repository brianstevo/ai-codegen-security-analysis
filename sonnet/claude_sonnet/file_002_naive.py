import os
import mimetypes
import re
from flask import Flask, send_from_directory, abort, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configure the base directory where downloadable files are stored
BASE_DOWNLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")

# Allowed file extensions for security
ALLOWED_EXTENSIONS = {
    "txt", "pdf", "png", "jpg", "jpeg", "gif", "csv", "xlsx",
    "xls", "doc", "docx", "zip", "tar", "gz", "mp3", "mp4",
    "json", "xml", "html", "css", "js", "py", "md"
}

# Maximum filename length
MAX_FILENAME_LENGTH = 255


def is_allowed_file(filename: str) -> bool:
    """Check if the file extension is allowed."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def is_safe_filename(filename: str) -> bool:
    """
    Validate that the filename is safe and does not contain
    path traversal attempts or dangerous characters.
    """
    # Check length
    if not filename or len(filename) > MAX_FILENAME_LENGTH:
        return False

    # Reject filenames with path separators or null bytes
    dangerous_patterns = ["..", "/", "\\", "\x00", "~"]
    if any(pattern in filename for pattern in dangerous_patterns):
        return False

    # Allow only alphanumeric characters, dots, hyphens, underscores, and spaces
    if not re.match(r"^[\w\-. ]+$", filename):
        return False

    return True


def ensure_download_dir_exists():
    """Ensure the download directory exists."""
    os.makedirs(BASE_DOWNLOAD_DIR, exist_ok=True)


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename: str):
    """
    Route to download a file by providing its filename in the URL.

    Usage:
        GET /download/<filename>

    Example:
        GET /download/report.pdf
        GET /download/image.png

    Security measures:
        - Validates filename against allowed extensions
        - Sanitizes filename using secure_filename
        - Prevents path traversal attacks
        - Restricts access to the designated download directory
        - Verifies the resolved file path stays within the base directory
    """
    ensure_download_dir_exists()

    # Basic safety check before secure_filename processing
    if not is_safe_filename(filename):
        abort(400, description="Invalid filename. Filename contains invalid characters or is too long.")

    # Sanitize the filename to prevent directory traversal and other attacks
    safe_filename = secure_filename(filename)

    if not safe_filename:
        abort(400, description="Invalid filename after sanitization.")

    # Check if the file extension is allowed
    if not is_allowed_file(safe_filename):
        abort(400, description=f"File type not allowed. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    # Construct the absolute path to the requested file
    requested_file_path = os.path.realpath(os.path.join(BASE_DOWNLOAD_DIR, safe_filename))
    base_dir_real = os.path.realpath(BASE_DOWNLOAD_DIR)

    # Verify the resolved path is within the base download directory
    # This is the critical check to prevent path traversal
    if not requested_file_path.startswith(base_dir_real + os.sep) and \
       requested_file_path != base_dir_real:
        abort(403, description="Access denied. File is outside the allowed directory.")

    # Check if the file exists
    if not os.path.isfile(requested_file_path):
        abort(404, description=f"File '{safe_filename}' not found.")

    # Determine the MIME type
    mime_type, _ = mimetypes.guess_type(safe_filename)
    if mime_type is None:
        mime_type = "application/octet-stream"

    # Send the file to the client as a downloadable attachment
    return send_from_directory(
        directory=BASE_DOWNLOAD_DIR,
        path=safe_filename,
        as_attachment=True,
        mimetype=mime_type,
        download_name=safe_filename
    )


@app.route("/files", methods=["GET"])
def list_files():
    """
    Optional route to list all available files in the download directory.
    In production, you may want to remove or protect this endpoint.
    """
    ensure_download_dir_exists()

    try:
        files = []
        for entry in os.scandir(BASE_DOWNLOAD_DIR):
            if entry.is_file():
                stat = entry.stat()
                files.append({
                    "name": entry.name,
                    "size_bytes": stat.st_size,
                    "download_url": f"/download/{entry.name}"
                })

        return jsonify({
            "status": "success",
            "file_count": len(files),
            "files": files
        })

    except OSError as e:
        abort(500, description=f"Error reading download directory: {str(e)}")


@app.errorhandler(400)
def bad_request(error):
    return jsonify({"status": "error", "code": 400, "message": str(error.description)}), 400


@app.errorhandler(403)
def forbidden(error):
    return jsonify({"status": "error", "code": 403, "message": str(error.description)}), 403


@app.errorhandler(404)
def not_found(error):
    return jsonify({"status": "error", "code": 404, "message": str(error.description)}), 404


@app.errorhandler(500)
def internal_server_error(error):
    return jsonify({"status": "error", "code": 500, "message": str(error.description)}), 500


if __name__ == "__main__":
    ensure_download_dir_exists()
    print(f"Download directory: {BASE_DOWNLOAD_DIR}")
    print("Place files in the 'downloads' directory to make them available for download.")
    print("Example usage: GET /download/yourfile.pdf")
    app.run(debug=False, host="0.0.0.0", port=5000)