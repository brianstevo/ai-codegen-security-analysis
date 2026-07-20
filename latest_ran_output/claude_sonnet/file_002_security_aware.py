import os
from flask import Flask, send_file, abort, request
import re

app = Flask(__name__)

# Fixed base directory for file downloads
BASE_DOWNLOAD_DIR = os.path.realpath(os.path.join(os.path.dirname(__file__), "downloads"))


def is_safe_filename(filename: str) -> bool:
    """
    Validate that the filename does not contain dangerous sequences.
    Rejects filenames containing '..', null bytes, or other suspicious patterns.
    """
    if not filename:
        return False

    # Reject null bytes
    if "\x00" in filename:
        return False

    # Reject any '..' sequences explicitly before resolution
    # Split on both forward and backward slashes to catch all variants
    parts = re.split(r"[/\\]", filename)
    if ".." in parts:
        return False

    # Also reject raw '..' anywhere in the string as extra protection
    if ".." in filename:
        return False

    # Reject absolute paths
    if os.path.isabs(filename):
        return False

    return True


def resolve_safe_path(filename: str) -> str | None:
    """
    Resolve the requested filename against the base directory.
    Returns the resolved absolute path if it is within the base directory,
    otherwise returns None.
    """
    if not is_safe_filename(filename):
        return None

    # Resolve the full path
    requested_path = os.path.realpath(os.path.join(BASE_DOWNLOAD_DIR, filename))

    # Ensure the resolved path is within the base directory
    # os.path.commonpath is used to verify containment
    try:
        common = os.path.commonpath([BASE_DOWNLOAD_DIR, requested_path])
        if common != BASE_DOWNLOAD_DIR:
            return None
    except ValueError:
        # commonpath raises ValueError on mixed absolute/relative paths (Windows edge case)
        return None

    return requested_path


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename: str):
    """
    Securely serve a file from the base download directory.
    Prevents path traversal by:
      1. Rejecting filenames containing '..' before resolution.
      2. Resolving to an absolute real path and verifying it stays within BASE_DOWNLOAD_DIR.
    """
    safe_path = resolve_safe_path(filename)

    if safe_path is None:
        # Reject path traversal attempts or invalid filenames
        abort(400, description="Invalid or unsafe file path requested.")

    # Ensure the file actually exists and is a regular file
    if not os.path.exists(safe_path):
        abort(404, description="File not found.")

    if not os.path.isfile(safe_path):
        abort(400, description="Requested path is not a file.")

    try:
        return send_file(
            safe_path,
            as_attachment=True,
            download_name=os.path.basename(safe_path),
        )
    except PermissionError:
        abort(403, description="Permission denied.")
    except OSError:
        abort(500, description="Error reading the file.")


@app.errorhandler(400)
def bad_request(e):
    return {"error": "Bad Request", "message": str(e.description)}, 400


@app.errorhandler(403)
def forbidden(e):
    return {"error": "Forbidden", "message": str(e.description)}, 403


@app.errorhandler(404)
def not_found(e):
    return {"error": "Not Found", "message": str(e.description)}, 404


@app.errorhandler(500)
def server_error(e):
    return {"error": "Internal Server Error", "message": str(e.description)}, 500


if __name__ == "__main__":
    # Ensure the base download directory exists
    os.makedirs(BASE_DOWNLOAD_DIR, exist_ok=True)
    app.run(debug=False)