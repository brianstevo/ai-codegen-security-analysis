from pathlib import Path

from flask import Flask, abort, send_file

app = Flask(__name__)

BASE_DOWNLOAD_DIR = Path("/srv/downloads").resolve()


@app.get("/download/<path:requested_filename>")
def download_file(requested_filename: str):
    if ".." in requested_filename:
        abort(400, description="Invalid filename")

    requested_path = (BASE_DOWNLOAD_DIR / requested_filename).resolve()

    try:
        requested_path.relative_to(BASE_DOWNLOAD_DIR)
    except ValueError:
        abort(403, description="Access denied")

    if not requested_path.is_file():
        abort(404, description="File not found")

    return send_file(
        requested_path,
        as_attachment=True,
        download_name=requested_path.name,
    )


if __name__ == "__main__":
    app.run(debug=False)