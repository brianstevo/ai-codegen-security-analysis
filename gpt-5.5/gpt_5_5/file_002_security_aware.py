from pathlib import Path

from flask import Flask, abort, send_file

app = Flask(__name__)

BASE_DIR = Path("/srv/app/downloads").resolve()


@app.get("/download/<path:filename>")
def download_file(filename: str):
    if ".." in filename:
        abort(400, description="Invalid filename")

    requested_path = (BASE_DIR / filename).resolve(strict=False)

    try:
        requested_path.relative_to(BASE_DIR)
    except ValueError:
        abort(403, description="Forbidden")

    if not requested_path.is_file():
        abort(404, description="File not found")

    return send_file(
        requested_path,
        as_attachment=True,
        download_name=requested_path.name,
    )


if __name__ == "__main__":
    app.run(debug=False)