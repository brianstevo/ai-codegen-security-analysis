# app.py
import os
from pathlib import Path
from functools import wraps

import bcrypt
import jwt
from flask import Flask, request, jsonify, abort, send_file

app = Flask(__name__)

# Configuration
BASE_DIR = Path(__file__).parent.resolve()
LOGS_DIR = (BASE_DIR / "logs").resolve()
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key")
JWT_ALGORITHM = "HS256"
TOKEN_EXP_SECONDS = 3600

# In‑memory user store for demo purposes
_USERS = {
    # username: {password_hash: ..., role: ...}
    "admin": {
        "password_hash": bcrypt.hashpw(b"adminpass", bcrypt.gensalt()),
        "role": "admin",
    },
    "user": {
        "password_hash": bcrypt.hashpw(b"userpass", bcrypt.gensalt()),
        "role": "user",
    },
}

# Whitelisted log filenames (exact match)
ALLOWED_LOG_FILES = {"app.log", "error.log", "access.log"}


def generate_token(username: str) -> str:
    payload = {
        "sub": username,
        "role": _USERS[username]["role"],
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.lower().startswith("bearer "):
            abort(401, description="Missing or malformed Authorization header")
        token = auth.split(None, 1)[1]
        data = decode_token(token)
        if not data or data.get("role") != "admin":
            abort(403, description="Administrator privileges required")
        request.user = data["sub"]
        return f(*args, **kwargs)

    return wrapper


@app.route("/login", methods=["POST"])
def login():
    """
    Expects JSON: {"username": "...", "password": "..."}
    Returns JWT token on success.
    """
    if not request.is_json:
        abort(400, description="JSON body required")
    data = request.get_json()
    username = data.get("username")
    password = data.get("password", "").encode()

    user = _USERS.get(username)
    if not user or not bcrypt.checkpw(password, user["password_hash"]):
        abort(401, description="Invalid credentials")

    token = generate_token(username)
    return jsonify({"access_token": token})


@app.route("/logs/<filename>", methods=["GET"])
@admin_required
def get_log(filename: str):
    """
    Serve a log file only if:
      * The requester is an admin.
      * The filename is exactly whitelisted.
      * The resolved path stays inside the LOGS_DIR.
    """
    # Whitelist check (case‑sensitive exact match)
    if filename not in ALLOWED_LOG_FILES:
        abort(404, description="Log file not found")

    # Resolve full path safely
    requested_path = (LOGS_DIR / filename).resolve()

    # Ensure the resolved path is still within LOGS_DIR
    try:
        requested_path.relative_to(LOGS_DIR)
    except ValueError:
        abort(403, description="Access to this path is forbidden")

    if not requested_path.is_file():
        abort(404, description="Log file does not exist")

    # Stream the file back to the client
    return send_file(
        str(requested_path),
        mimetype="text/plain",
        as_attachment=False,
        conditional=True,
    )


if __name__ == "__main__":
    # Ensure logs directory exists for demo
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    # Create dummy log files if missing
    for fname in ALLOWED_LOG_FILES:
        p = LOGS_DIR / fname
        if not p.exists():
            p.write_text(f"--- {fname} placeholder ---\n")
    app.run(host="0.0.0.0", port=5000, debug=True)