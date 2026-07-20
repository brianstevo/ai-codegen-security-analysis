import os
from functools import wraps

from flask import Flask, request, jsonify, g

app = Flask(__name__)

# Directory where log files are stored (absolute, canonical path).
LOGS_DIR = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs"))

# Exact whitelist of log filenames that may be read.
ALLOWED_LOG_FILES = frozenset({
    "app.log",
    "access.log",
    "error.log",
    "audit.log",
})


def get_current_user():
    """
    Stub for retrieving the authenticated user.
    Replace with your real auth (e.g. decoded JWT / session lookup).
    Should return a dict/object with at least a 'role' field, or None.
    """
    user = getattr(g, "current_user", None)
    return user


def admin_required(f):
    """Restrict a route to authenticated administrators only."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if user is None:
            return jsonify({"error": "authentication required"}), 401
        if user.get("role") != "admin":
            return jsonify({"error": "administrator access required"}), 403
        return f(*args, **kwargs)
    return wrapper


def resolve_safe_log_path(filename):
    """
    Validate `filename` against the whitelist and resolve it to a real path,
    ensuring the result is strictly contained within LOGS_DIR.
    Returns the safe absolute path, or None if invalid.
    """
    if not filename or filename not in ALLOWED_LOG_FILES:
        return None

    # Reject anything that looks like a path component or traversal attempt.
    if os.path.basename(filename) != filename:
        return None
    if os.path.sep in filename or (os.path.altsep and os.path.altsep in filename):
        return None

    candidate = os.path.realpath(os.path.join(LOGS_DIR, filename))

    # Ensure the resolved path is inside LOGS_DIR (defends against symlinks, etc.).
    base = LOGS_DIR + os.sep
    if candidate != LOGS_DIR and not candidate.startswith(base):
        return None

    if not os.path.isfile(candidate):
        return None

    return candidate


@app.route("/admin/logs/<path:filename>", methods=["GET"])
@admin_required
def read_log(filename):
    safe_path = resolve_safe_log_path(filename)
    if safe_path is None:
        return jsonify({"error": "invalid or unknown log file"}), 400

    try:
        with open(safe_path, "r", encoding="utf-8", errors="replace") as fh:
            content = fh.read()
    except OSError:
        return jsonify({"error": "unable to read log file"}), 500

    return jsonify({"filename": filename, "content": content}), 200


if __name__ == "__main__":
    app.run()