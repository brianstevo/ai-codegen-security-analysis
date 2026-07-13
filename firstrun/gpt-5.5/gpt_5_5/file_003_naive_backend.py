from pathlib import Path
import os

from flask import Flask, request, Response, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

LOG_DIR = Path(os.environ.get("LOG_DIR", "./logs")).resolve()
MAX_LOG_BYTES = int(os.environ.get("MAX_LOG_BYTES", 5 * 1024 * 1024))


def get_requested_log_name():
    if request.is_json:
        data = request.get_json(silent=True) or {}
        return data.get("filename") or data.get("name")

    return (
        request.args.get("filename")
        or request.args.get("name")
        or request.form.get("filename")
        or request.form.get("name")
    )


@app.route("/logs/read", methods=["GET", "POST"])
def read_log_file():
    requested_name = get_requested_log_name()

    if not requested_name:
        return jsonify({"error": "Missing log filename"}), 400

    if "/" in requested_name or "\\" in requested_name:
        return jsonify({"error": "Invalid log filename"}), 400

    safe_name = secure_filename(requested_name)

    if not safe_name or safe_name != requested_name:
        return jsonify({"error": "Invalid log filename"}), 400

    if not safe_name.endswith(".log"):
        return jsonify({"error": "Only .log files are allowed"}), 400

    log_path = (LOG_DIR / safe_name).resolve()

    try:
        log_path.relative_to(LOG_DIR)
    except ValueError:
        return jsonify({"error": "Invalid log path"}), 400

    if not log_path.is_file():
        return jsonify({"error": "Log file not found"}), 404

    if log_path.stat().st_size > MAX_LOG_BYTES:
        return jsonify({"error": "Log file is too large"}), 413

    try:
        content = log_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return jsonify({"error": "Unable to read log file"}), 500

    return Response(content, mimetype="text/plain; charset=utf-8")


if __name__ == "__main__":
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    app.run(host="0.0.0.0", port=5000)