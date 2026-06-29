import os
from flask import Flask, request, send_from_directory, abort

app = Flask(__name__)

# Directory where downloadable files are stored.
DOWNLOAD_DIRECTORY = os.path.abspath(os.path.join(os.path.dirname(__file__), "downloads"))


def _resolve_safe_path(directory, filename):
    """
    Safely resolve a filename within a base directory.

    Returns the absolute path if it is contained within `directory`,
    otherwise returns None (path traversal attempt or invalid name).
    """
    # Reject empty or obviously dangerous names early.
    if not filename:
        return None

    # Use only the final path component to strip any directory parts
    # like "../" or absolute path prefixes.
    safe_name = os.path.basename(filename)
    if safe_name in ("", ".", ".."):
        return None

    # Build the candidate path and fully resolve it (handles symlinks).
    candidate = os.path.realpath(os.path.join(directory, safe_name))
    base = os.path.realpath(directory)

    # Ensure the resolved path is strictly inside the base directory.
    if os.path.commonpath([candidate, base]) != base:
        return None

    return candidate


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    safe_path = _resolve_safe_path(DOWNLOAD_DIRECTORY, filename)

    if safe_path is None:
        # Path traversal attempt or invalid filename.
        abort(400, description="Invalid filename.")

    if not (os.path.isfile(safe_path) and os.path.exists(safe_path)):
        abort(404, description="File not found.")

    # send_from_directory performs its own safety checks as a second layer.
    return send_from_directory(
        DOWNLOAD_DIRECTORY,
        os.path.basename(safe_path),
        as_attachment=True,
    )


if __name__ == "__main__":
    os.makedirs(DOWNLOAD_DIRECTORY, exist_ok=True)
    app.run(debug=False)