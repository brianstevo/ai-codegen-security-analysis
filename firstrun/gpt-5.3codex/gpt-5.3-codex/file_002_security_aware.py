from pathlib import Path
from flask import Flask, request, abort, send_from_directory

app = Flask(__name__)

# Fixed base directory for downloadable files
BASE_DIR = Path("/var/app/downloads").resolve()


@app.route("/download", methods=["GET"])
def download_file():
    filename = request.args.get("filename", "", type=str)

    if not filename:
        abort(400, description="Missing filename")

    # Explicitly reject path traversal attempts containing '..'
    if ".." in filename:
        abort(400, description="Invalid filename")

    # Resolve path against base directory
    requested_path = (BASE_DIR / filename).resolve()

    # Ensure resolved path remains within BASE_DIR
    try:
        requested_path.relative_to(BASE_DIR)
    except ValueError:
        abort(403, description="Access denied")

    # Ensure file exists and is a regular file
    if not requested_path.is_file():
        abort(404, description="File not found")

    # Safely serve from validated directory/path
    return send_from_directory(
        directory=str(requested_path.parent),
        path=requested_path.name,
        as_attachment=True
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)