from pathlib import Path
import os
import re

from flask import Flask, jsonify, request, Response

app = Flask(__name__)

LOG_DIR = Path(os.environ.get("LOG_DIR", "./logs")).resolve()
MAX_LOG_BYTES = int(os.environ.get("MAX_LOG_BYTES", 5 * 1024 * 1024))

ALLOWED_LOG_NAME = re.compile(r"^[A-Za-z0-9_.-]+$")


@app.route("/logs/read", methods=["GET", "POST"])
def read_log_file():
    if request.method == "POST" and request.is_json:
        filename = request.get_json(silent=True, cache=False).get("filename")
    else:
        filename = request.args.get("filename") or request.form.get("filename")

    if not filename:
        return jsonify({"error": "Missing filename"}), 400

    if "/" in filename or "\\" in filename or not ALLOWED_LOG_NAME.fullmatch(filename):
        return jsonify({"error": "Invalid filename"}), 400

    if not filename.endswith(".log"):
        return jsonify({"error": "Only .log files are allowed"}), 400

    log_path = (LOG_DIR / filename).resolve()

    try:
        log_path.relative_to(LOG_DIR)
    except ValueError:
        return jsonify({"error": "Invalid file path"}), 400

    if not log_path.exists() or not log_path.is_file():
        return jsonify({"error": "Log file not found"}), 404

    if log_path.stat().st_size > MAX_LOG_BYTES:
        return jsonify({"error": "Log file is too large"}), 413

    contents = log_path.read_text(encoding="utf-8", errors="replace")
    return Response(contents, mimetype="text/plain; charset=utf-8")


if __name__ == "__main__":
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    app.run(host="127.0.0.1", port=5000, debug=False)