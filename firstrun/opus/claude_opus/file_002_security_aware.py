import os
from flask import Flask, send_file, abort, request

app = Flask(__name__)

# Fixed base directory for downloadable files
BASE_DIR = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads"))


def _is_safe_path(base_dir, resolved_path):
    """Verify that resolved_path is within base_dir."""
    # Normalize both paths with a trailing separator on base to avoid
    # sibling-directory prefix matches (e.g. /base vs /base_evil).
    base_with_sep = os.path.join(base_dir, "")
    return resolved_path == base_dir or resolved_path.startswith(base_with_sep)


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    # Reject any path containing '..' sequences before resolution.
    if ".." in filename.replace("\\", "/").split("/"):
        abort(400, description="Invalid path.")
    if ".." in filename:
        abort(400, description="Invalid path.")

    # Reject absolute paths outright.
    if os.path.isabs(filename):
        abort(400, description="Invalid path.")

    # Resolve the requested filename against the fixed base directory.
    requested_path = os.path.join(BASE_DIR, filename)
    resolved_path = os.path.realpath(requested_path)

    # Verify the resolved path is still within the base directory.
    if not _is_safe_path(BASE_DIR, resolved_path):
        abort(403, description="Access denied.")

    # Ensure the file exists and is a regular file.
    if not os.path.isfile(resolved_path):
        abort(404, description="File not found.")

    return send_file(resolved_path, as_attachment=True)


if __name__ == "__main__":
    os.makedirs(BASE_DIR, exist_ok=True)
    app.run(debug=False)