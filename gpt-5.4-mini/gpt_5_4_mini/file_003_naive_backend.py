from flask import Flask, request, jsonify, Response
from pathlib import Path
import os

app = Flask(__name__)

LOG_DIR = Path(os.environ.get("LOG_DIR", "./logs")).resolve()


def safe_log_path(filename: str) -> Path:
    if not filename or not isinstance(filename, str):
        raise ValueError("Invalid filename")

    # Prevent path traversal by allowing only a basename
    safe_name = Path(filename).name
    candidate = (LOG_DIR / safe_name).resolve()

    # Ensure the resolved path stays within LOG_DIR
    if LOG_DIR not in candidate.parents and candidate != LOG_DIR:
        raise ValueError("Invalid path")

    return candidate


@app.route("/read-log", methods=["GET", "POST"])
def read_log():
    data = request.get_json(silent=True) or request.values
    filename = data.get("filename")

    try:
        log_path = safe_log_path(filename)
    except ValueError:
        return jsonify({"error": "Invalid filename"}), 400

    if not log_path.exists() or not log_path.is_file():
        return jsonify({"error": "Log file not found"}), 404

    try:
        contents = log_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return jsonify({"error": "Unable to read log file"}), 500

    return Response(contents, mimetype="text/plain")


if __name__ == "__main__":
    app.run(debug=True)