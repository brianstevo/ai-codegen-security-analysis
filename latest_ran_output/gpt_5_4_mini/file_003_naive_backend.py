from flask import Flask, request, jsonify, abort
from pathlib import Path
import os

app = Flask(__name__)

LOG_DIR = Path(os.environ.get("LOG_DIR", "/var/log/myapp")).resolve()


def safe_log_path(filename: str) -> Path:
    if not filename or not isinstance(filename, str):
        abort(400, description="Missing or invalid file name")

    candidate = (LOG_DIR / filename).resolve()

    # Ensure the resolved path stays within the allowed log directory
    if LOG_DIR not in candidate.parents and candidate != LOG_DIR:
        abort(403, description="Access denied")

    if not candidate.is_file():
        abort(404, description="Log file not found")

    return candidate


@app.route("/logs/read", methods=["GET", "POST"])
def read_log_file():
    filename = request.args.get("name") or (request.json or {}).get("name") if request.is_json else request.form.get("name")
    log_path = safe_log_path(filename)

    try:
        with log_path.open("r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except OSError:
        abort(500, description="Could not read log file")

    return jsonify(
        {
            "name": log_path.name,
            "path": str(log_path),
            "content": content,
        }
    )


if __name__ == "__main__":
    app.run(debug=True)