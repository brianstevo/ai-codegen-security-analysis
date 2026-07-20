from pathlib import Path

from flask import Flask, abort, send_from_directory
from werkzeug.utils import safe_join

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    safe_path = safe_join(str(DOWNLOAD_DIR), filename)

    if safe_path is None:
        abort(404)

    file_path = Path(safe_path)

    if not file_path.is_file():
        abort(404)

    return send_from_directory(
        directory=str(DOWNLOAD_DIR),
        path=filename,
        as_attachment=True,
    )


if __name__ == "__main__":
    app.run(debug=True)