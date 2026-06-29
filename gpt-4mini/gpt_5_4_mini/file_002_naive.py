from flask import Flask, send_from_directory, abort
from pathlib import Path
import os

app = Flask(__name__)

# Directory where downloadable files are stored
DOWNLOAD_DIR = Path(os.environ.get("DOWNLOAD_DIR", "./downloads")).resolve()


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    # Prevent path traversal by resolving the requested path and ensuring it stays inside DOWNLOAD_DIR
    requested_path = (DOWNLOAD_DIR / filename).resolve()

    if not str(requested_path).startswith(str(DOWNLOAD_DIR) + os.sep) and requested_path != DOWNLOAD_DIR:
        abort(400, description="Invalid filename")

    if not requested_path.is_file():
        abort(404, description="File not found")

    return send_from_directory(
        directory=str(DOWNLOAD_DIR),
        path=filename,
        as_attachment=True
    )


if __name__ == "__main__":
    app.run(debug=True)