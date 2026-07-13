import os
from flask import Flask, send_file, abort, request

app = Flask(__name__)

# Fixed base directory for downloadable files
BASE_DIRECTORY = os.path.realpath("/var/www/downloads")


def is_safe_path(base_dir: str, requested_path: str) -> bool:
    """
    Verify that the resolved path is within the base directory.
    Returns True if the path is safe, False otherwise.
    """
    # Reject any path containing '..' sequences before resolution
    if ".." in requested_path:
        return False

    # Reject null bytes
    if "\x00" in requested_path:
        return False

    # Resolve the full path (resolves symlinks and normalizes)
    full_path = os.path.realpath(os.path.join(base_dir, requested_path))

    # Ensure the resolved path starts with the base directory
    # Use os.path.commonpath for a robust comparison
    try:
        common = os.path.commonpath([base_dir, full_path])
        return common == base_dir
    except ValueError:
        # commonpath raises ValueError on mixed absolute/relative paths (Windows edge case)
        return False


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename: str):
    """
    Securely serve a file for download from the fixed base directory.
    Prevents path traversal attacks by:
      1. Rejecting filenames containing '..' before any resolution.
      2. Resolving the full path and confirming it remains within BASE_DIRECTORY.
    """
    # Ensure base directory exists
    if not os.path.isdir(BASE_DIRECTORY):
        app.logger.error("Base download directory does not exist: %s", BASE_DIRECTORY)
        abort(500, description="Server configuration error.")

    # Validate the requested filename
    if not filename or not filename.strip():
        abort(400, description="Filename must not be empty.")

    # Strip leading slashes to prevent absolute path injection
    filename = filename.lstrip("/\\")

    # Check path safety (includes '..' rejection and boundary check)
    if not is_safe_path(BASE_DIRECTORY, filename):
        app.logger.warning(
            "Path traversal attempt detected. Requested filename: %r | Remote addr: %s",
            filename,
            request.remote_addr,
        )
        abort(400, description="Invalid file path.")

    # Build the resolved absolute path
    resolved_path = os.path.realpath(os.path.join(BASE_DIRECTORY, filename))

    # Ensure the resolved path is a regular file (not a directory, symlink to dir, etc.)
    if not os.path.isfile(resolved_path):
        abort(404, description="File not found.")

    try:
        return send_file(
            resolved_path,
            as_attachment=True,
            download_name=os.path.basename(resolved_path),
        )
    except PermissionError:
        app.logger.error("Permission denied when accessing file: %s", resolved_path)
        abort(403, description="Access denied.")
    except OSError as exc:
        app.logger.error("OS error when serving file %s: %s", resolved_path, exc)
        abort(500, description="Could not serve the requested file.")


@app.errorhandler(400)
def bad_request(exc):
    return {"error": "Bad Request", "message": str(exc.description)}, 400


@app.errorhandler(403)
def forbidden(exc):
    return {"error": "Forbidden", "message": str(exc.description)}, 403


@app.errorhandler(404)
def not_found(exc):
    return {"error": "Not Found", "message": str(exc.description)}, 404


@app.errorhandler(500)
def internal_error(exc):
    return {"error": "Internal Server Error", "message": str(exc.description)}, 500


if __name__ == "__main__":
    app.run(debug=False)