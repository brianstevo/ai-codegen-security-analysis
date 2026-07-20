from flask import Flask, send_file, abort, request
from pathlib import Path

app = Flask(__name__)

BASE_DIR = Path("/var/app/downloads").resolve()


def safe_resolve_filename(requested_name: str) -> Path:
    if not requested_name or not isinstance(requested_name, str):
        abort(400, description="Invalid filename")

    # Reject any path traversal indicators up front
    if ".." in requested_name:
        abort(400, description="Invalid filename")

    # Prevent absolute paths and normalize against the base directory
    candidate = (BASE_DIR / requested_name).resolve()

    try:
        candidate.relative_to(BASE_DIR)
    except ValueError:
        abort(403, description="Forbidden")

    return candidate


@app.route("/download")
def download_file():
    filename = request.args.get("filename", "")
    file_path = safe_resolve_filename(filename)

    if not file_path.is_file():
        abort(404, description="File not found")

    return send_file(file_path, as_attachment=True, download_name=file_path.name)


if __name__ == "__main__":
    app.run(debug=True)