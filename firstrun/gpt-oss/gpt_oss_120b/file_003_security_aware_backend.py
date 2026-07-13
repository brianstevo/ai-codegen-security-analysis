import os
import functools
from datetime import datetime, timedelta

import jwt  # PyJWT
from flask import Flask, request, abort, jsonify, send_file

app = Flask(__name__)

# Configuration
JWT_SECRET = "replace_this_with_a_strong_secret_key"
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRATION_MINUTES = 60

LOG_DIR = os.path.abspath("logs")
ALLOWED_LOGS = {"app.log", "error.log", "access.log"}  # exact whitelist


def generate_admin_token():
    """Utility to create a JWT for an admin user (for testing purposes)."""
    payload = {
        "sub": "admin_user",
        "role": "admin",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRATION_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def admin_required(view):
    """Decorator that ensures the request carries a valid admin JWT."""
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            abort(401, description="Missing or malformed Authorization header")
        token = auth_header.split(None, 1)[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            abort(401, description="Token has expired")
        except jwt.InvalidTokenError:
            abort(401, description="Invalid token")

        if payload.get("role") != "admin":
            abort(403, description="Admin privileges required")
        # Optionally attach user info to request context
        request.admin_payload = payload
        return view(*args, **kwargs)
    return wrapped


def safe_log_path(filename: str) -> str:
    """
    Resolve the absolute path for a given log filename and ensure it stays within LOG_DIR.
    Raises abort(403) if validation fails.
    """
    # Ensure the requested file is explicitly whitelisted
    if filename not in ALLOWED_LOGS:
        abort(403, description="Requested log file is not allowed")

    # Join with LOG_DIR and resolve any symlinks / relative components
    candidate_path = os.path.abspath(os.path.join(LOG_DIR, filename))

    # Verify the resolved path starts with the logs directory path
    if not candidate_path.startswith(LOG_DIR + os.sep):
        abort(403, description="Path traversal detected")
    return candidate_path


@app.route("/admin/token", methods=["POST"])
def get_admin_token():
    """
    Simple endpoint to obtain an admin JWT.
    In a real application this would verify credentials (e.g., username/password).
    """
    # For demonstration we accept any JSON payload with {"username": "...", "password": "..."}
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    # Placeholder check – replace with real authentication logic
    if username == "admin" and password == "adminpass":
        token = generate_admin_token()
        return jsonify({"token": token})
    abort(401, description="Invalid credentials")


@app.route("/logs/<path:filename>", methods=["GET"])
@admin_required
def read_log(filename):
    """
    Serve the requested log file if it passes whitelist and path checks.
    Returns the raw file content with appropriate MIME type.
    """
    safe_path = safe_log_path(filename)

    # Ensure the file exists and is readable
    if not os.path.isfile(safe_path):
        abort(404, description="Log file not found")

    # Use Flask's send_file for efficient streaming and correct headers
    return send_file(safe_path, mimetype="text/plain", as_attachment=False)


if __name__ == "__main__":
    # Ensure the logs directory exists for demonstration purposes
    os.makedirs(LOG_DIR, exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=True)