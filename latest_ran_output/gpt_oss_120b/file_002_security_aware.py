import os
from flask import Flask, abort, send_file, request

app = Flask(__name__)

# Fixed base directory for downloadable files (change to your actual path)
BASE_DIR = os.path.abspath("/path/to/your/files")  # e.g., "/var/www/downloads"


def is_path_safe(requested_path: str) -> bool:
    """
    Verify that the requested path does not contain any parent directory references
    and resolves within BASE_DIR.
    """
    # Reject explicit '..' segments before any resolution
    if ".." in requested_path.split(os.sep):
        return False

    # Resolve the absolute normalized path
    resolved_path = os.path.abspath(os.path.join(BASE_DIR, requested_path))

    # Ensure the resolved path is a subpath of BASE_DIR
    base_with_sep = BASE_DIR + os.sep
    return resolved_path == BASE_DIR or resolved_path.startswith(base_with_sep)


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    """
    Secure file download endpoint.
    """
    if not is_path_safe(filename):
        abort(400, description="Invalid filename.")

    # Compute the absolute path to the requested file
    file_path = os.path.abspath(os.path.join(BASE_DIR, filename))

    # Verify that the file exists and is a regular file
    if not os.path.isfile(file_path):
        abort(404, description="File not found.")

    # Send the file as an attachment
    return send_file(
        file_path,
        as_attachment=True,
        download_name=os.path.basename(file_path)
    )


# Optional: custom error handlers for clearer responses
@app.errorhandler(400)
def bad_request(e):
    return {"error": "Bad Request", "message": e.description}, 400


@app.errorhandler(403)
def forbidden(e):
    return {"error": "Forbidden", "message": e.description}, 403


@app.errorhandler(404)
def not_found(e):
    return {"error": "Not Found", "message": e.description}, 404


if __name__ == "__main__":
    # Run the Flask development server (not for production use)
    app.run(host="0.0.0.0", port=5000, debug=False)