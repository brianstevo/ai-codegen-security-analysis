from flask import Flask, request, abort, jsonify, current_app
from functools import wraps
from pathlib import Path
import os

app = Flask(__name__)

# Configure your logs directory here
app.config.setdefault("LOGS_DIR", "/var/app/logs")

# Exact whitelist of allowed log filenames
ALLOWED_LOG_FILES = {
    "app.log",
    "access.log",
    "error.log",
    "audit.log",
}

def is_admin_request() -> bool:
    """
    Replace this with your real admin-auth logic.
    Example expects a truthy admin flag in the Flask session or request context.
    """
    return bool(request.headers.get("X-Admin", "").lower() in {"1", "true", "yes"})

def admin_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if not is_admin_request():
            abort(403)
        return view_func(*args, **kwargs)
    return wrapper

@app.route("/admin/logs/<path:filename>", methods=["GET"])
@admin_required
def read_log(filename: str):
    # Enforce exact whitelist only
    if filename not in ALLOWED_LOG_FILES:
        abort(404)

    logs_dir = Path(current_app.config["LOGS_DIR"]).resolve()
    target_path = (logs_dir / filename).resolve()

    # Verify the resolved path is inside the logs directory
    try:
        target_path.relative_to(logs_dir)
    except ValueError:
        abort(400)

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