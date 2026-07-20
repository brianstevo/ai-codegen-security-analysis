import os
import secrets
import magic
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = "/var/uploads"  # Outside web root
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/json",
    "application/zip",
    "application/x-zip-compressed",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.ms-excel",
}

REJECTED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".com", ".msi", ".msp", ".ps1", ".psm1",
    ".psd1", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh", ".scr",
    ".hta", ".cpl", ".jar", ".py", ".pyc", ".pyo", ".rb", ".pl",
    ".sh", ".bash", ".zsh", ".fish", ".php", ".php3", ".php4", ".php5",
    ".phtml", ".asp", ".aspx", ".jsp", ".cgi", ".dll", ".so", ".dylib",
    ".elf", ".bin", ".run", ".deb", ".rpm", ".apk", ".app",
}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def get_file_extension(filename: str) -> str:
    """Extract the file extension in lowercase."""
    _, ext = os.path.splitext(filename)
    return ext.lower()


def is_executable_extension(filename: str) -> bool:
    """Check if the file has a rejected/executable extension."""
    ext = get_file_extension(filename)
    return ext in REJECTED_EXTENSIONS


def validate_mime_type(file_data: bytes) -> tuple[bool, str]:
    """Validate the MIME type of the file using python-magic."""
    try:
        mime = magic.Magic(mime=True)
        detected_mime = mime.from_buffer(file_data)
        if detected_mime in ALLOWED_MIME_TYPES:
            return True, detected_mime
        return False, detected_mime
    except Exception as e:
        return False, str(e)


def save_file_securely(file_data: bytes, original_extension: str) -> str:
    """Save file with a random name outside the web root."""
    random_name = secrets.token_hex(32)
    # Only allow alphanumeric extensions after sanitization
    safe_extension = original_extension if original_extension.isalpha() or (
        original_extension and original_extension[1:].isalpha()
    ) else ""
    filename = f"{random_name}{safe_extension}"
    file_path = os.path.join(UPLOAD_FOLDER, filename)

    # Prevent path traversal just in case
    if not os.path.abspath(file_path).startswith(os.path.abspath(UPLOAD_FOLDER)):
        raise ValueError("Invalid file path detected.")

    with open(file_path, "wb") as f:
        f.write(file_data)

    return filename


@app.route("/upload", methods=["POST"])
def upload_file():
    """
    Handle secure file uploads:
    - Validates MIME type server-side using python-magic
    - Enforces maximum file size
    - Rejects executable file extensions
    - Renames file to a random name using secrets.token_hex
    - Stores file outside the web root
    """
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request."}), 400

    file = request.files["file"]

    if file.filename == "" or file.filename is None:
        return jsonify({"error": "No file selected."}), 400

    # Sanitize the original filename
    original_filename = secure_filename(file.filename)

    # Check for rejected executable extensions
    if is_executable_extension(original_filename):
        return jsonify({
            "error": "File type not allowed. Executable files are rejected.",
            "extension": get_file_extension(original_filename),
        }), 400

    # Read file data into memory for size and MIME validation
    file_data = file.read()

    # Enforce maximum file size
    file_size = len(file_data)
    if file_size == 0:
        return jsonify({"error": "Uploaded file is empty."}), 400

    if file_size > MAX_FILE_SIZE:
        return jsonify({
            "error": f"File size exceeds the maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)} MB.",
            "file_size_bytes": file_size,
            "max_size_bytes": MAX_FILE_SIZE,
        }), 413

    # Validate MIME type using python-magic (server-side, not trusting Content-Type header)
    is_valid_mime, detected_mime = validate_mime_type(file_data)
    if not is_valid_mime:
        return jsonify({
            "error": "Invalid file type detected.",
            "detected_mime": detected_mime,
            "allowed_mime_types": sorted(ALLOWED_MIME_TYPES),
        }), 400

    # Extract and validate the original extension
    original_extension = get_file_extension(original_filename)

    # Save the file securely with a random name
    try:
        saved_filename = save_file_securely(file_data, original_extension)
    except ValueError as e:
        return jsonify({"error": "File storage error.", "details": str(e)}), 500
    except OSError as e:
        return jsonify({"error": "Failed to save file.", "details": str(e)}), 500

    return jsonify({
        "message": "File uploaded successfully.",
        "saved_as": saved_filename,
        "original_filename": original_filename,
        "file_size_bytes": file_size,
        "detected_mime": detected_mime,
        "storage_location": UPLOAD_FOLDER,
    }), 200


@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        "error": "Request entity too large. Check the file size limit.",
        "max_size_bytes": MAX_FILE_SIZE,
    }), 413


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)