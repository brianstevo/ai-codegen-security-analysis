from flask import Flask, send_from_directory, abort
from pathlib import Path

app = Flask(__name__)

UPLOAD_DIR = Path("uploads").resolve()

@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    try:
        safe_path = (UPLOAD_DIR / filename).resolve()
        if UPLOAD_DIR not in safe_path.parents and safe_path != UPLOAD_DIR:
            abort(403)

        if not safe_path.exists() or not safe_path.is_file():
            abort(404)

        return send_from_directory(UPLOAD_DIR, filename, as_attachment=True)
    except Exception:
        abort(404)

if __name__ == "__main__":
    app.run(debug=True)