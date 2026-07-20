```python
import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import Flask, jsonify, request

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration – load from environment in production; never hard-code secrets
# ---------------------------------------------------------------------------
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "change-me-in-production-use-a-long-random-value")
ALGORITHM = "HS256"
TOKEN_EXPIRY_MINUTES = 30

# ---------------------------------------------------------------------------
# Simulated user store (replace with a real DB; passwords stored as bcrypt hashes)
# ---------------------------------------------------------------------------
USERS = {
    "alice": {
        "user_id": "u-001",
        "username": "alice",
        "password_hash": "$2b$12$placeholderHashForAlice",  # bcrypt hash in real usage
        "role": "admin",
        "email": "alice@example.com",
    },
    "bob": {
        "user_id": "u-002",
        "username": "bob",
        "password_hash": "$2b$12$placeholderHashForBob",
        "role": "user",
        "email": "bob@example.com",
    },
}

# ---------------------------------------------------------------------------
# Fields that must never appear in any API response
# ---------------------------------------------------------------------------
SENSITIVE_FIELDS = {"password", "password_hash", "token", "secret", "access_token", "refresh_token"}


def sanitize(data: dict) -> dict:
    """Recursively strip sensitive fields from a dictionary before returning it."""
    if not isinstance(data, dict):
        return data
    return {
        key: sanitize(value) if isinstance(value, dict) else value
        for key, value in data.items()
        if key.lower() not in SENSITIVE_FIELDS
    }


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_token(user: dict) -> str:
    """Issue a signed JWT for the given user record."""
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": user["user_id"],
        "username": user["username"],
        "role": user["role"],
        "iat": now,
        "exp": now + timedelta(minutes=TOKEN_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT.  Raises jwt.PyJWTError subclasses on failure.
    """
    return jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM],
        options={"require": ["exp", "iat", "sub", "role"]},
    )


def extract_bearer_token(auth_header: str | None) -> str | None:
    """Pull the raw token string out of an 'Authorization: Bearer <token>' header."""
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


# ---------------------------------------------------------------------------
# Decorators
# ---------------------------------------------------------------------------

def jwt_required(f):
    """Verify that a valid, non-expired JWT is present in the Authorization header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        raw_token = extract_bearer_token(request.headers.get("Authorization"))
        if not raw_token:
            return jsonify({"error": "Authentication required: missing or malformed token"}), 401

        try:
            payload = decode_token(raw_token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as exc:
            # Keep the message generic to avoid leaking internal details
            app.logger.warning("Invalid token received: %s", exc)
            return jsonify({"error": "Invalid token"}), 401

        # Attach decoded payload to the request context for downstream use
        request.token_payload = payload
        return f(*args, **kwargs)

    return decorated


def admin_required(f):
    """
    Verify that the authenticated user holds the 'admin' role.
    Must be applied *after* @jwt_required so that request.token_payload is set.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        payload = getattr(request, "token_payload", None)
        if payload is None or payload.get("role") != "admin":
            return jsonify({"error": "Forbidden: administrator privileges required"}), 403
        return f(*args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Public route – token issuance (demo only; use bcrypt password check in prod)
# ---------------------------------------------------------------------------

@app.route("/auth/token", methods=["POST"])
def issue_token():
    """
    POST /auth/token
    Body: {"username": "alice", "password": "secret"}
    Returns a signed JWT (demo: password check is skipped; add bcrypt in production).
    """
    body = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    # password = body.get("password", "")  # Validate with bcrypt.checkpw in production

    user = USERS.get(username)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # --- In production, replace the line below with a bcrypt password check ---
    # if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
    #     return jsonify({"error": "Invalid credentials"}), 401

    token = create_token(user)
    return jsonify({"access_token": token, "token_type": "bearer", "expires_in": TOKEN_EXPIRY_MINUTES * 60}), 200


# ---------------------------------------------------------------------------
# Admin-only routes
# ---------------------------------------------------------------------------

@app.route("/admin/dashboard", methods=["GET"])
@jwt_required
@admin_required
def admin_dashboard():
    """
    GET /admin/dashboard
    Returns a summary visible only to admins.
    Sensitive fields are stripped from every response automatically.
    """
    payload = request.token_payload
    summary = {
        "message": "Welcome to the admin dashboard",
        "admin_user": payload.get("username"),
        "total_users": len(USERS),
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }
    return jsonify(sanitize(summary)), 200


@app.route("/admin/users", methods=["GET"])
@jwt_required
@admin_required
def list_users():
    """
    GET /admin/users
    Returns all users, stripping any sensitive fields before responding.
    """
    safe_users = [sanitize(user) for user in USERS.values()]
    return jsonify({"users": safe_users, "count": len(safe_users)}), 200


@app.route("/admin/users/<user_id>", methods=["GET"])
@jwt_required
@admin_required
def get_user(user_id: str):
    """
    GET /admin/users/<user_id>
    Returns a single user record with sensitive fields removed.
    """
    user = next((u for u in USERS.values() if u["user_id"] == user_id), None)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": sanitize(user)}), 200


# ---------------------------------------------------------------------------
# Global error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(401)
def unauthorized(exc):
    return jsonify({"error": "Unauthorized"}), 401


@app.errorhandler(403)
def forbidden(exc):
    return jsonify({"error": "Forbidden"}), 403


@app.errorhandler(404)
def not_found(exc):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(405)
def method_not_allowed(exc):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(500)
def internal_error(exc):
    app.logger.exception("