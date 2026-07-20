```python
import os
import mimetypes
import unicodedata
import re
from flask import Flask, send_from_directory, abort, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
BASE_DOWNLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
MAX_FILENAME_LENGTH = 255
ALLOWED_EXTENSIONS = {
    # Documents
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "odt",
    # Images
    "jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico",
    # Audio/Video
    "mp3", "mp4", "wav", "avi", "mov", "mkv", "flac",
    # Archives
    "zip", "tar", "gz", "7z", "rar",
    # Code/Data
    "json", "xml", "yaml", "yml", "html", "css", "js",
}

# Ensure the downloads directory exists
os.makedirs(BASE_DOWNLOAD_DIR, exist_ok=True)


def is_safe_filename(filename: str) -> bool:
    """
    Validate that a filename is safe to use for file access.
    Returns True if safe, False otherwise.
    """
    if not filename or not isinstance(filename, str):
        return False

    # Check length
    if len(filename) > MAX_FILENAME_LENGTH:
        return False

    # Normalize unicode to prevent unicode tricks
    try:
        filename = unicodedata.normalize("NFKC", filename)
    except (TypeError, ValueError):
        return False

    # Reject null bytes
    if "\x00" in filename:
        return False

    # Reject path separators and traversal attempts
    dangerous_patterns = [
        "..",           # Directory traversal
        "/",            # Unix path separator
        "\\",           # Windows path separator
        "~",            # Home directory reference
        "$",            # Variable expansion
        "|",            # Pipe
        ";",            # Command separator
        "&",            # Background execution
        "`",            # Command substitution
        ">",            # Redirect
        "<",            # Redirect
    ]
    for pattern in dangerous_patterns:
        if pattern in filename:
            return False

    # Reject names that are just dots
    if re.match(r"^\.+$", filename):
        return False

    # Reject Windows reserved names
    reserved_names = {
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    }
    name_without_ext = os.path.splitext(filename)[0].upper()
    if name_without_ext in reserved_names:
        return False

    # Only allow safe characters: alphanumeric, dash, underscore, dot, space
    if not re.match(r"^[\w\-. ]+$", filename):
        return False

    return True


def get_file_extension(filename: str) -> str:
    """Extract the file extension in lowercase."""
    _, ext = os.path.splitext(filename)
    return ext.lstrip(".").lower()


def is_allowed_extension(filename: str) -> bool:
    """Check if the file extension is in the allowed set."""
    ext = get_file_extension(filename)
    return ext in ALLOWED_EXTENSIONS


def resolve_safe_path(base_dir: str, filename: str) -> str | None:
    """
    Resolve the full path and ensure it stays within base_dir.
    Returns the resolved path if safe, None otherwise.
    """
    base_dir = os.path.realpath(base_dir)
    full_path = os.path.realpath(os.path.join(base_dir, filename))

    # Ensure the resolved path starts with base_dir (prevent traversal)
    if not full_path.startswith(base_dir + os.sep) and full_path != base_dir:
        return None

    return full_path


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename: str):
    """
    Download a file by its filename from the secure downloads directory.

    URL: GET /download/<filename>
    Example: GET /download/report.pdf

    Query Parameters:
        inline (optional): If "true", display file inline instead of downloading.

    Returns:
        - 200: File content with appropriate headers
        - 400: Invalid filename
        - 403: Extension not allowed
        - 404: File not found
        - 500: Server error
    """
    # --- Input Validation ---

    if not filename:
        abort(400, description="Filename is required.")

    # Use werkzeug's secure_filename as an additional sanitization layer
    safe_name = secure_filename(filename)
    if not safe_name:
        abort(400, description="Invalid filename after sanitization.")

    # Custom validation
    if not is_safe_filename(safe_name):
        abort(400, description="Filename contains invalid or unsafe characters.")

    # Check extension allowlist
    if not is_allowed_extension(safe_name):
        ext = get_file_extension(safe_name)
        abort(403, description=f"File extension '.{ext}' is not permitted for download.")

    # --- Path Resolution & Traversal Prevention ---

    resolved_path = resolve_safe_path(BASE_DOWNLOAD_DIR, safe_name)
    if resolved_path is None:
        # Path traversal attempt detected
        app.logger.warning(
            "Path traversal attempt detected. "
            "Remote IP: %s | Requested filename: %s",
            request.remote_addr,
            filename,
        )
        abort(400, description="Invalid file path.")

    # --- File Existence Check ---

    if not os.path.exists(resolved_path):
        abort(404, description=f"File '{safe_name}' not found.")

    if not os.path.isfile(resolved_path):
        abort(400, description=f"'{safe_name}' is not a file.")

    # --- Serve the File ---

    # Determine whether to serve inline or as attachment
    inline = request.args.get("inline", "false").lower() == "true"
    as_attachment = not inline

    # Detect MIME type
    mime_type, _ = mimetypes.guess_type(safe_name)
    if not mime_type:
        mime_type = "application/octet-stream"

    app.logger.info(
        "File download: '%s' | MIME: %s | IP: %s",
        safe_name,
        mime_type,
        request.remote_addr,
    )

    try:
        return send_from_directory(
            directory=BASE_DOWNLOAD_DIR,
            path=safe_name,
            as_attachment=as_attachment,
            download_name=safe_name,
            mimetype=mime_type,
        )
    except Exception as e:
        app.logger.error("Error serving file '%s': %s", safe_name, str(e))
        abort(500, description="An error occurred while serving the file.")


@app.route("/files", methods=["GET"])
def list_files():
    """
    List all available files in the downloads directory.
    Useful for discovering downloadable files.

    Returns:
        200: JSON list of available files with metadata.
    """
    try:
        files = []
        for entry in os.scandir(BASE_DOWNLOAD_DIR):
            if entry.is_file():
                ext = get_file_extension(entry.name)
                if ext in ALLOWED_EXTENSIONS:
                    stat = entry.stat()
                    mime_type, _ = mimetypes.guess_type(entry.name)
                    files.append({
                        "filename": entry.name,
                        "size_bytes": stat.st_size,