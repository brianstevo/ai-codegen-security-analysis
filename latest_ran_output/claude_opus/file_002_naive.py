import os
from flask import Flask, send_from_directory, abort, request
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Directory where downloadable files are stored. Keep this outside any
# user-writable or sensitive location.
DOWNLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "downloads"))
os.makedirs(DOWNLOAD_DIR, exist_ok=True)


def _resolve_safe_path(base_dir, filename):
    """
    Safely resolve a user-supplied filename against base_dir.

    Returns the absolute path if it is a regular file that lives strictly
    inside base_dir, otherwise returns None. This defends against path
    traversal (e.g. '../../etc/passwd'), absolute paths, and symlink escapes.
    """
    if not filename:
        return None

    # Strip any directory components a client might inject and normalize.
    safe_name = secure_filename(filename)
    if not safe_name:
        return None

    # Build the candidate path and fully resolve symlinks / '..' segments.
    candidate = os.path.realpath(os.path.join(base_dir, safe_name))
    base_real = os.path.realpath(base_dir)

    # Ensure the resolved path is contained within the base directory.
    # Using commonpath avoids prefix-matching pitfalls (e.g. '/base' vs '/base_evil').
    try:
        if os.path.commonpath([candidate, base_real]) != base_real:
            return None
    except ValueError:
        # Raised if paths are on different drives (Windows) etc.
        return None

    if not os.path.isfile(candidate):
        return None

    return candidate, safe_name


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    resolved = _resolve_safe_path(DOWNLOAD_DIR, filename)
    if resolved is None:
        # Do not distinguish between "not found" and "forbidden" to avoid
        # leaking information about the filesystem layout.
        abort(404)

    _, safe_name = resolved
    return send_from_directory(
        DOWNLOAD_DIR,
        safe_name,
        as_attachment=True,
        download_name=safe_name,
    )


@app.errorhandler(404)
def not_found(_e):
    return {"error": "File not found."}, 404


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)