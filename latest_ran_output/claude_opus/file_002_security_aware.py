import os
from flask import Flask, request, abort, send_file

app = Flask(__name__)

# Fixed base directory for downloads
BASE_DIR = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads"))


@app.route("/download", methods=["GET"])
def download_file():
    filename = request.args.get("filename", "")

    # Reject empty filenames
    if not filename:
        abort(400, description="Missing filename parameter.")

    # Reject absolute paths
    if os.path.isabs(filename):
        abort(400, description="Invalid filename.")

    # Reject any path containing '..' sequences before resolution
    # Check both raw string and normalized path components
    normalized = filename.replace("\\", "/")
    if ".." in normalized.split("/") or ".." in filename:
        abort(400, description="Invalid filename: path traversal detected.")

    # Resolve the requested filename against the fixed base directory
    requested_path = os.path.realpath(os.path.join(BASE_DIR, filename))

    # Verify the resolved path is still within the base directory
    # Use commonpath to guard against traversal and symlink escapes
    try:
        common = os.path.commonpath([BASE_DIR, requested_path])
    except ValueError:
        # Raised if paths are on different drives (Windows) or invalid mix
        abort(400, description="Invalid filename.")

    if common != BASE_DIR:
        abort(403, description="Access denied: path outside base directory.")

    # Ensure the resolved path exists and is a regular file
    if not os.path.isfile(requested_path):
        abort(404, description="File not found.")

    return send_file(requested_path, as_attachment=True)


if __name__ == "__main__":
    os.makedirs(BASE_DIR, exist_ok=True)
    app.run(debug=False)