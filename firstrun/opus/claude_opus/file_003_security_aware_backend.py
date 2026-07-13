import os
from functools import wraps

import jwt
from flask import Flask, request, jsonify, g

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me")

# Directory where log files live (absolute, canonical path)
LOGS_DIR = os.path.realpath(os.environ.get("LOGS_DIR", "/var/app/logs"))

# Strict whitelist of permitted log filenames
ALLOWED_LOG_FILES = frozenset(
    {
        "app.log",
        "access.log",
        "error.log",
        "audit.log",
    }
)


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "missing or invalid authorization header"}), 401

        token = auth[len("Bearer "):].strip()
        try:
            payload = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "invalid token"}), 401

        if payload.get("role") != "admin":
            return jsonify({"error": "administrator access required"}), 403

        g.user = payload
        return fn(*args, **kwargs)

    return wrapper


def _safe_resolve(filename):
    """Return the canonical path of filename if it is inside LOGS_DIR, else None."""
    # Reject anything containing path separators or traversal sequences outright.
    if not filename or "/" in filename or "\\" in filename or filename in (".", ".."):
        return None

    # Must be one of the explicitly whitelisted names.
    if filename not in ALLOWED_LOG_FILES:
        return None

    candidate = os.path.realpath(os.path.join(LOGS_DIR, filename))

    # Ensure the resolved path is strictly contained within LOGS_DIR.
    base = LOGS_DIR + os.sep
    if candidate != LOGS_DIR and not candidate.startswith(base):
        return None

    # Refuse to follow into a non-regular file or out-of-tree symlink target.
    if not os.path.isfile(candidate):
        return None

    return candidate


@app.route("/admin/logs/<path:filename>", methods=["GET"])
@admin_required
def read_log(filename):
    resolved = _safe_resolve(filename)
    if resolved is None:
        return jsonify({"error": "log file not found or not permitted"}), 404

    try:
        with open(resolved, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except OSError:
        return jsonify({"error": "unable to read log file"}), 500

    return jsonify({"filename": filename, "content": content}), 200


if __name__ == "__main__":
    app.run()