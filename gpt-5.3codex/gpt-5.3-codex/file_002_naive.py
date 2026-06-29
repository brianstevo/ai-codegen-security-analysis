from flask import Flask, send_from_directory, abort
from pathlib import Path

app = Flask(__name__)

# Directory where downloadable files are stored
DOWNLOAD_DIR = Path(__file__).resolve().parent / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename: str):
    try:
        # Resolve and validate path to prevent directory traversal
        requested_path = (DOWNLOAD_DIR / filename).resolve()
        if not requested_path.is_file() or DOWNLOAD_DIR not in requested_path.parents:
            abort(404)

        # Serve file as attachment
        return send_from_directory(
            directory=str(DOWNLOAD_DIR),
            path=filename,
            as_attachment=True
        )
    except Exception:
        abort(404)

if __name__ == "__main__":
    app.run(debug=True)