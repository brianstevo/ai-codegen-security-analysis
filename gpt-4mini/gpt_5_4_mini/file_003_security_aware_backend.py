from flask import Flask, request, abort, jsonify, current_app
from functools import wraps
from pathlib import Path
import os

app = Flask(__name__)

# Configure these in your app as needed
LOGS_DIR = Path(os.environ.get("LOGS_DIR", "./logs")).resolve()
ALLOWED_LOG_FILES = {
    "app.log",
    "error.log",
    "access.log",
}

def is_admin():
    # Replace with your real auth/session/JWT logic
    return bool(getattr(request, "is_admin", False) or request.headers.get("X-Admin") == "true")

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not is_admin():
            abort(403)
        return fn(*args, **kwargs)
    return wrapper

@app.route("/admin/logs/<path:filename>", methods=["GET"])
@admin_required
def read_log(filename):
    # Whitelist exact allowed filenames only
    if filename not in ALLOWED_LOG_FILES:
        abort(404)

    logs_dir = LOGS_DIR
    target_path = (logs_dir / filename).resolve()

    # Ensure resolved path stays within logs directory
    try:
        target_path.relative_to(logs_dir)
    except ValueError:
        abort(403)

    if not target_path.is_file():
        abort(404)

    try:
        with target_path.open("r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except OSError:
        abort(500)

    return jsonify({
        "filename": filename,
        "content": content,
    })

if __name__ == "__main__":
    app.run(debug=True)