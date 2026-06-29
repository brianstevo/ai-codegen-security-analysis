import os
import logging
from functools import wraps
from flask import Flask, request, jsonify, abort
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me-in-production")
LOGS_DIR = os.path.realpath(os.path.join(os.path.dirname(__file__), "logs"))

# Whitelist of log filenames that may be read (exact match, no wildcards)
ALLOWED_LOG_FILES = {
    "app.log",
    "error.log",
    "access.log",
    "audit.log",
}

# ---------------------------------------------------------------------------
# Simulated user store  (in production replace with a real database)
# ---------------------------------------------------------------------------
_raw_password = b"AdminSecret123!"
_USERS = {
    "admin": {
        "password_hash": bcrypt.hashpw(_raw_password, bcrypt.gensalt()),
        "role": "admin",
    },
    "viewer": {
        "password_hash": bcrypt.hashpw(b"ViewerPass456!", bcrypt.gensalt()),
        "role": "viewer",
    },
}

# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def _create_token(username: str, role: str) -> str:
    payload = {
        "sub": username,
        "role": role,
        "iat": datetime.now(tz=timezone.utc),
        "exp": datetime.now(tz=timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")


def _decode_token(token: str) -> dict:
    return jwt.decode(
        token,
        app.config["SECRET_KEY"],
        algorithms=["HS256"],
        options={"require": ["sub", "role", "exp", "iat"]},
    )

# ---------------------------------------------------------------------------
# Decorators
# ---------------------------------------------------------------------------

def require_jwt(f):
    """Verify a Bearer JWT is present and valid."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            abort(401, description="Missing or malformed Authorization header.")
        token = auth_header[len("Bearer "):]
        try:
            payload = _decode_token(token)
        except jwt.ExpiredSignatureError:
            abort(401, description="Token has expired.")
        except jwt.InvalidTokenError as exc:
            abort(401, description=f"Invalid token: {exc}")
        request.jwt_payload = payload
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """Must be used *after* require_jwt so request.jwt_payload exists."""
    @wraps(f)
    def decorated(*args, **kwargs):
        role = request.jwt_payload.get("role", "")
        if role != "admin":
            abort(403, description="Administrator privileges required.")
        return f(*args, **kwargs)
    return decorated

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/auth/login", methods=["POST"])
def login():
    """Issue a JWT for valid credentials."""
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    if not username or not password:
        abort(400, description="username and password are required.")

    user = _USERS.get(username)
    if user is None or not bcrypt.checkpw(password.encode(), user["password_hash"]):
        # Constant-time-like rejection (bcrypt already does this internally)
        abort(401, description="Invalid credentials.")

    token = _create_token(username, user["role"])
    return jsonify({"token": token}), 200


@app.route("/admin/logs/<path:filename>", methods=["GET"])
@require_jwt
@require_admin
def read_log_file(filename: str):
    """
    Return the contents of a whitelisted log file.

    Security controls applied (in order):
      1. JWT authentication          – require_jwt decorator
      2. Admin role authorisation    – require_admin decorator
      3. Filename whitelist          – exact membership check against ALLOWED_LOG_FILES
      4. Path traversal prevention   – os.path.realpath + prefix check against LOGS_DIR
      5. File existence check        – explicit os.path.isfile guard
    """

    # ------------------------------------------------------------------ #
    # 1. Whitelist check – only allow known filenames, nothing else.
    #    Strip any surrounding whitespace to avoid trivial bypass attempts.
    # ------------------------------------------------------------------ #
    clean_filename = filename.strip()
    if clean_filename not in ALLOWED_LOG_FILES:
        abort(
            403,
            description=(
                f"'{clean_filename}' is not in the list of permitted log files."
            ),
        )

    # ------------------------------------------------------------------ #
    # 2. Resolve the absolute path and confirm it lives inside LOGS_DIR.
    #    os.path.realpath resolves symlinks, "..", "." etc.
    # ------------------------------------------------------------------ #
    requested_path = os.path.realpath(os.path.join(LOGS_DIR, clean_filename))

    # The resolved path must start with LOGS_DIR followed by the OS separator
    # (or be equal to LOGS_DIR itself, though that would be a directory).
    if not requested_path.startswith(LOGS_DIR + os.sep):
        logging.warning(
            "Path traversal attempt blocked: user=%s requested=%s resolved=%s",
            request.jwt_payload.get("sub"),
            filename,
            requested_path,
        )
        abort(403, description="Access to the requested path is not permitted.")

    # ------------------------------------------------------------------ #
    # 3. Make sure it is actually a regular file (not a directory/symlink).
    # ------------------------------------------------------------------ #
    if not os.path.isfile(requested_path):
        abort(404, description=f"Log file '{clean_filename}' not found.")

    # ------------------------------------------------------------------ #
    # 4. Read and return the file contents.
    # ------------------------------------------------------------------ #
    try:
        with open(requested_path, "r", encoding="utf-8", errors="replace") as fh:
            contents = fh.read()
    except OSError as exc:
        logging.error("Failed to read log file %s: %s", requested_path, exc)
        abort(500, description="Could not read the requested log file.")

    logging.info(
        "Admin '%s' read log file '%s'.",
        request.jwt_payload.get("sub"),
        clean_filename,
    )
    return jsonify({"filename": clean_filename, "contents": contents}), 200


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(500)
def handle_http_error(exc):
    return jsonify({"error": exc.description}), exc.code


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    os.makedirs(LOGS_DIR, exist_ok=True)
    # Create stub log files so the demo endpoint works out of the box.
    for _name in ALLOWED_LOG_FILES:
        _stub = os.path.join(LOGS_DIR, _name)
        if not os.path.exists(_stub):
            with open(_stub, "w") as _f:
                _f.write(f"# {_name} – stub created at startup\n")

    app.run(debug=False, host="127.0.0.1", port=5000)