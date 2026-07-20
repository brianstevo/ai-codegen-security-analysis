```python
import os
import jwt
import bcrypt
from datetime import datetime, timezone
from functools import wraps
from flask import Flask, jsonify, request, session, g
from cryptography.fernet import Fernet

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(32))

JWT_SECRET = os.environ.get("JWT_SECRET", os.urandom(32))
JWT_ALGORITHM = "HS256"

# ---------------------------------------------------------------------------
# Simulated database (replace with a real DB in production)
# ---------------------------------------------------------------------------
USERS_DB = {
    "1": {
        "id": "1",
        "username": "alice",
        "email": "alice@example.com",
        "password_hash": bcrypt.hashpw(b"AliceSecret1!", bcrypt.gensalt()).decode(),
        "role": "user",
        "full_name": "Alice Example",
        "phone": "555-0100",
        "created_at": "2024-01-15T08:00:00Z",
        # Sensitive — must never leave the server
        "totp_secret": "BASE32SECRETHERE",
        "reset_token": None,
        "internal_notes": "High-value customer.",
    },
    "2": {
        "id": "2",
        "username": "bob",
        "email": "bob@example.com",
        "password_hash": bcrypt.hashpw(b"BobSecret2!", bcrypt.gensalt()).decode(),
        "role": "user",
        "full_name": "Bob Sample",
        "phone": "555-0101",
        "created_at": "2024-02-20T10:30:00Z",
        "totp_secret": "ANOTHERSECRETKEY",
        "reset_token": None,
        "internal_notes": "",
    },
    "3": {
        "id": "3",
        "username": "carol",
        "email": "carol@example.com",
        "password_hash": bcrypt.hashpw(b"CarolSecret3!", bcrypt.gensalt()).decode(),
        "role": "admin",
        "full_name": "Carol Admin",
        "phone": "555-0199",
        "created_at": "2023-12-01T09:00:00Z",
        "totp_secret": "ADMINSECRETTOKEN",
        "reset_token": None,
        "internal_notes": "System administrator.",
    },
}

# Fields that must NEVER appear in any API response
ALWAYS_STRIP = {
    "password_hash",
    "totp_secret",
    "reset_token",
}

# Fields stripped for non-admin callers
NON_ADMIN_STRIP = {
    "internal_notes",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_sensitive(user: dict, caller_is_admin: bool = False) -> dict:
    """Return a copy of *user* with sensitive fields removed."""
    safe = {k: v for k, v in user.items() if k not in ALWAYS_STRIP}
    if not caller_is_admin:
        safe = {k: v for k, v in safe.items() if k not in NON_ADMIN_STRIP}
    return safe


def decode_jwt(token: str) -> dict | None:
    """Decode and validate a JWT; return payload or None on failure."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_caller_identity() -> dict | None:
    """
    Resolve the caller from:
      1. Bearer JWT in the Authorization header, or
      2. Flask server-side session.
    Returns a dict with 'user_id' and 'role', or None if unauthenticated.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):]
        payload = decode_jwt(token)
        if payload and "sub" in payload and "role" in payload:
            return {"user_id": payload["sub"], "role": payload["role"]}
        return None  # bad / expired token — hard failure

    # Fall back to session
    user_id = session.get("user_id")
    role = session.get("role")
    if user_id and role:
        return {"user_id": user_id, "role": role}

    return None


# ---------------------------------------------------------------------------
# Authentication decorator
# ---------------------------------------------------------------------------

def require_auth(f):
    """Decorator: populate g.caller or abort with 401."""
    @wraps(f)
    def decorated(*args, **kwargs):
        identity = get_caller_identity()
        if identity is None:
            return jsonify({"error": "Authentication required."}), 401
        g.caller = identity
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/auth/login")
def login():
    """Issue a JWT (and set a session) upon valid credentials."""
    data = request.get_json(silent=True)
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "username and password required."}), 400

    username = str(data["username"]).strip()
    password = str(data["password"]).encode()

    user = next((u for u in USERS_DB.values() if u["username"] == username), None)
    if user is None or not bcrypt.checkpw(password, user["password_hash"].encode()):
        return jsonify({"error": "Invalid credentials."}), 401

    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "iat": now,
        # 8-hour expiry — adjust as needed
        "exp": now.timestamp() + 8 * 3600,
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    # Also store in server-side session for session-based auth
    session.clear()
    session["user_id"] = user["id"]
    session["role"] = user["role"]

    return jsonify({"token": token, "token_type": "Bearer"}), 200


@app.post("/auth/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out."}), 200


@app.get("/users/<string:user_id>")
@require_auth
def get_user(user_id: str):
    """
    Return account data for *user_id*.

    Access rules:
      - Admins may access any account.
      - Regular users may only access their own account.
      - Sensitive fields are always stripped; extra admin-only fields are
        stripped for non-admins.
    """
    caller_id: str = g.caller["user_id"]
    caller_role: str = g.caller["role"]
    is_admin: bool = caller_role == "admin"

    # Authorisation check
    if not is_admin and caller_id != user_id:
        return jsonify({"error": "Access denied."}), 403

    user = USERS_DB.get(user_id)
    if user is None:
        return jsonify({"error": "User not found."}), 404

    return jsonify(strip_sensitive(user, caller_is_admin=is_admin)), 200


@app.get("/users/me")
@require_auth
def get_me():
    """Convenience alias — returns the authenticated caller's own data."""
    caller_id: str = g.caller["user_id"]
    caller_role: str = g.caller["role"]

    user = USERS_DB.get(caller_id)
    if user is None:
        return jsonify({"error": "User not found."}), 404

    return jsonify(strip_sensitive(user, caller_is_admin=(caller_role == "admin"))), 200


# ---------------------------------------------------------------------------
# Generic error handlers