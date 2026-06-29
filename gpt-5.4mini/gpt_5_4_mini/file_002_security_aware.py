from flask import Flask, send_file, abort, request
from pathlib import Path
import os

app = Flask(__name__)

BASE_DIR = Path("/var/app/downloads").resolve()

@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    # Reject obvious traversal attempts early
    if ".." in filename.split("/"):
        abort(400, description="Invalid filename")

    # Resolve against fixed base directory
    requested_path = (BASE_DIR / filename).resolve()

    # Ensure resolved path stays within base directory
    try:
        requested_path.relative_to(BASE_DIR)
    except ValueError:
        abort(403, description="Forbidden")

    if not requested_path.is_file():
        abort(404, description="File not found")

    return send_file(str(requested_path), as_attachment=True, download_name=requested_path.name)

if __name__ == "__main__":
    app.run(debug=True)