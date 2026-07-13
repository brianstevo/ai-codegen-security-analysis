```python
import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
import jwt
from flask import Flask, request, jsonify, make_response
from cryptography.fernet import Fernet

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", secrets.token_hex(32))
app.config["JWT_ALGORITHM"] = "HS256"
app.config["JWT_ACCESS_EXPIRES"] = timedelta(hours=1)
app.config["REMEMBER_ME_EXPIRES"] = timedelta(days=30)
app.config["REMEMBER_ME_COOKIE"] = "remember_me_token"
app.config["HTTPS_ONLY"] = os.environ.get("HTTPS_ONLY", "false").lower() == "true"

# Fernet key for encrypting remember-me tokens stored in the DB
FERNET_KEY = os.environ.get("FERNET_KEY", Fernet.generate_key())
fernet = Fernet(FERNET_KEY)

# ---------------------------------------------------------------------------
# In-memory "database" (replace with a real DB in production)
# ---------------------------------------------------------------------------
# users  : { username: { "password_hash": bytes } }
# tokens : { token_hash: { "username": str, "expires_at": datetime } }
users: dict = {}
remember_me_tokens: dict = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash_token(raw_token: str) -> str:
    """SHA-256 hash of a raw token for safe DB storage."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _create_jwt(username: str) -> str:
    """Create a short-lived JWT access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iat": now,
        "exp": now + app.config["JWT_ACCESS_EXPIRES"],
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm=app.config["JWT_ALGORITHM"])


def _decode_jwt(token: str) -> dict | None:
    """Decode and validate a JWT; returns payload or None."""
    try:
        return jwt.decode(
            token,
            app.config["SECRET_KEY"],
            algorithms=[app.config["JWT_ALGORITHM"]],
        )
    except jwt.PyJWTError:
        return None


def _issue_remember_me_token(username: str) -> str:
    """
    Generate a cryptographically secure remember-me token,
    store its hash in the DB, and return the raw token to set in a cookie.
    """
    raw_token = secrets.token_urlsafe(64)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + app.config["REMEMBER_ME_EXPIRES"]

    # Encrypt username before storing (defence-in-depth)
    encrypted_username = fernet.encrypt(username.encode()).decode()
    remember_me_tokens[token_hash] = {
        "username_enc": encrypted_username,
        "expires_at": expires_at,
    }
    return raw_token


def _validate_remember_me_token(raw_token: str) -> str | None:
    """
    Validate a remember-me token cookie.
    Returns the associated username on success, else None.
    Rotates the token (issues a new one and deletes the old one).
    """
    token_hash = _hash_token(raw_token)
    record = remember_me_tokens.get(token_hash)
    if not record:
        return None

    if record["expires_at"] < datetime.now(timezone.utc):
        # Expired — clean up
        remember_me_tokens.pop(token_hash, None)
        return None

    try:
        username = fernet.decrypt(record["username_enc"].encode()).decode()
    except Exception:
        remember_me_tokens.pop(token_hash, None)
        return None

    # Token rotation: invalidate old token
    remember_me_tokens.pop(token_hash, None)
    return username


def _revoke_remember_me_token(raw_token: str) -> None:
    """Remove a remember-me token from the store."""
    token_hash = _hash_token(raw_token)
    remember_me_tokens.pop(token_hash, None)


def _set_remember_me_cookie(response, raw_token: str) -> None:
    """Attach the remember-me cookie to the response."""
    expires = datetime.now(timezone.utc) + app.config["REMEMBER_ME_EXPIRES"]
    response.set_cookie(
        app.config["REMEMBER_ME_COOKIE"],
        value=raw_token,
        expires=expires,
        httponly=True,                          # JS cannot read it
        secure=app.config["HTTPS_ONLY"],        # HTTPS-only in production
        samesite="Lax",
        path="/",
    )


def _clear_remember_me_cookie(response) -> None:
    """Delete the remember-me cookie."""
    response.delete_cookie(
        app.config["REMEMBER_ME_COOKIE"],
        path="/",
        httponly=True,
        secure=app.config["HTTPS_ONLY"],
        samesite="Lax",
    )


# ---------------------------------------------------------------------------
# Auth decorator
# ---------------------------------------------------------------------------

def login_required(f):
    """
    Decorator that requires a valid JWT.
    If the JWT is missing/expired but a valid remember-me cookie is present,
    it transparently re-issues a JWT and rotates the remember-me token.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # 1. Try Bearer JWT
        auth_header = request.headers.get("Authorization", "")
        jwt_token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else None
        username = None
        new_jwt = None
        new_rm_token = None

        if jwt_token:
            payload = _decode_jwt(jwt_token)
            if payload:
                username = payload["sub"]

        # 2. Fall back to remember-me cookie
        if not username:
            rm_cookie = request.cookies.get(app.config["REMEMBER_ME_COOKIE"])
            if rm_cookie:
                username = _validate_remember_me_token(rm_cookie)
                if username:
                    # Re-issue JWT + rotate remember-me token
                    new_jwt = _create_jwt(username)
                    new_rm_token = _issue_remember_me_token(username)

        if not username:
            return jsonify({"error": "Authentication required"}), 401

        # Inject caller identity
        request.current_user = username

        response = make_response(f(*args, **kwargs))

        # Attach refreshed tokens to response headers/cookies if we used RM
        if new_jwt:
            response.headers["X-New-Access-Token"] = new_jwt
        if new_rm_token:
            _set_remember_me_cookie(response, new_rm_token)

        return response

    return decorated


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/register", methods=["POST"])
def register():
    """Register a new user."""
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400
    if username in users:
        return jsonify({"error": "username already taken"}), 409

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
    users[username] = {"password_hash": password_hash}

    return jsonify({"message": "User registered successfully"}), 201


@app.route("/login", methods=["POST"])
def login():