```python
import os
import logging
from functools import wraps
from flask import Flask, request, jsonify, abort
import bcrypt
import jwt
import secrets
from datetime import datetime, timedelta

app = Flask(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
SECRET_KEY = secrets.token_hex(32)          # Replace with a persistent secret in production
LOGS_DIR   = os.path.realpath(             # Canonical path to the logs directory
    os.path.join(os.path.dirname(__file__), "logs")
)
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 30

# ── Whitelist of allowed log filenames (exact names only) ────────────────────
ALLOWED_LOG_FILES = frozenset({
    "app.log",
    "error.log",
    "access.log",
    "audit.log",
})

# ── Simulated user store (in production, use a real database) ────────────────
_raw_password = b"AdminSecret123!"
USERS = {
    "admin": {
        "password_hash": bcrypt.hashpw(_raw_password, bcrypt.gensalt()),
        "role": "admin",
    },
    "alice": {
        "password_hash": bcrypt.hashpw(b"AlicePass456!", bcrypt.gensalt()),
        "role": "user",
    },
}

# ── Logger ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def generate_token(username: str, role: str) -> str:
    """Issue a signed JWT for the given user."""
    payload = {
        "sub": username,
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=JWT_EXPIRY_MINUTES),
        "jti": secrets.token_hex(16),      # unique token id to support future revocation
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT; raises jwt.PyJWTError on failure."""
    return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])


def get_bearer_token() -> str | None:
    """Extract Bearer token from the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[len("Bearer "):]
    return None


# ── Decorators ───────────────────────────────────────────────────────────────

def login_required(f):
    """Verify a valid JWT is present."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_bearer_token()
        if not token:
            logger.warning("Request missing Bearer token from %s", request.remote_addr)
            abort(401, description="Authentication token required.")
        try:
            request.token_payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            logger.warning("Expired token from %s", request.remote_addr)
            abort(401, description="Token has expired.")
        except jwt.PyJWTError as exc:
            logger.warning("Invalid token from %s: %s", request.remote_addr, exc)
            abort(401, description="Invalid token.")
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Restrict access to users whose token carries role='admin'."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        role = request.token_payload.get("role")
        if role != "admin":
            username = request.token_payload.get("sub", "<unknown>")
            logger.warning(
                "Forbidden access attempt by non-admin user '%s' from %s",
                username, request.remote_addr,
            )
            abort(403, description="Administrator access required.")
        return f(*args, **kwargs)
    return decorated


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/auth/login", methods=["POST"])
def login():
    """
    POST /auth/login
    Body: { "username": "...", "password": "..." }
    Returns a signed JWT on success.
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    user = USERS.get(username)
    if not user or not isinstance(password, str) or not password:
        # Constant-time-ish rejection to resist user-enumeration
        bcrypt.checkpw(b"dummy", bcrypt.hashpw(b"dummy", bcrypt.gensalt()))
        abort(401, description="Invalid credentials.")

    if not bcrypt.checkpw(password.encode(), user["password_hash"]):
        logger.warning("Failed login for user '%s' from %s", username, request.remote_addr)
        abort(401, description="Invalid credentials.")

    token = generate_token(username, user["role"])
    logger.info("Successful login for user '%s' from %s", username, request.remote_addr)
    return jsonify({"token": token}), 200


@app.route("/admin/logs/<path:filename>", methods=["GET"])
@admin_required
def read_log(filename: str):
    """
    GET /admin/logs/<filename>
    Restricted to administrators.

    Security controls applied (in order):
      1. Whitelist  – filename must be in ALLOWED_LOG_FILES.
      2. Path resolution – os.path.realpath() resolves symlinks and '..' segments.
      3. Boundary check – resolved path must start with LOGS_DIR + os.sep.
      4. File existence – the file must exist and be a regular file.
    """
    admin_user = request.token_payload.get("sub", "<unknown>")

    # ── 1. Whitelist check ───────────────────────────────────────────────────
    # Accept only the bare filename (no slashes, no dots tricks).
    # flask's <path:> converter can include '/', so we reject anything that
    # is not a plain filename present in the whitelist.
    if filename not in ALLOWED_LOG_FILES:
        logger.warning(
            "Admin '%s' requested non-whitelisted log file '%s' from %s",
            admin_user, filename, request.remote_addr,
        )
        abort(400, description=f"Log file '{filename}' is not permitted.")

    # ── 2. Resolve the full path (symlinks, '..' sequences, etc.) ───────────
    requested_path = os.path.realpath(os.path.join(LOGS_DIR, filename))

    # ── 3. Boundary / directory-traversal check ──────────────────────────────
    # Ensure the resolved path is inside LOGS_DIR.
    # The trailing separator prevents a path like /logs_backup from matching /logs.
    if not requested_path.startswith(LOGS_DIR + os.sep):
        logger.critical(
            "Path-traversal attempt by admin '%s': resolved '%s' is outside logs dir. IP: %s",
            admin_user, requested_path, request.remote_addr,
        )
        abort(400, description="Invalid log file path.")

    # ── 4. File existence and type check ────────────────────────────────────
    if not os.path.isfile(requested_path):
        logger.warning(
            "Admin '%s' requested non-existent log '%s' from %s",
            admin_user, filename, request.remote_addr,
        )
        abort(404, description=f"Log file '{filename}' not found.")

    # ── Read and return the file ────────────────────────────────────────────
    try:
        with open(requested_path, "r", encoding="