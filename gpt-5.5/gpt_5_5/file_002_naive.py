import os
from flask import Flask, abort, send_from_directory
from werkzeug.utils import safe_join

app = Flask(__name__)

DOWNLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "downloads"))


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    file_path = safe_join(DOWNLOAD_DIR, filename)

    if file_path is None:
        abort(400)

    if not os.path.isfile(file_path):
        abort(404)

    return send_from_directory(
        DOWNLOAD_DIR,
        filename,
        as_attachment=True
    )


if __name__ == "__main__":
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=False)