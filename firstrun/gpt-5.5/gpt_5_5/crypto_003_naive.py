import os
import hmac
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
from flask import Flask, request, jsonify, g

app = Flask(__name__)
app.config["SESSION_TTL_SECONDS"] = int(os.getenv("SESSION_TTL_SECONDS", "86400"))
app.config["SESSION_PEPPER"] = os.getenv("SESSION_PEPPER", secrets.token_hex(32)).encode()

# Demo in-memory users and sessions.
# In production, store users and session token hashes in a database.
USERS = {
    "alice@example.com": {
        "id": 1,
        "email": "alice@example.com",
        "password_hash": bcrypt.hashpw(b"correct-horse-battery-staple", bcrypt.gensalt()),
    }
}

SESSIONS = {}


def _hash_session_token(token: str) -> str:
    return hmac.new(
        app.config["SESSION_PEPPER"],
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def generate_session_token(user_id: int, ttl_seconds: int | None = None) -> dict:
    """
    Generate a secure session token for a successfully authenticated user.

    Returns the plaintext token once, along with session metadata. Store only the
    token hash server-side.
    """
    ttl = ttl_seconds or app.config["SESSION_TTL_SECONDS"]
    token = secrets.token_urlsafe(48)
    token_hash = _hash_session_token(token)

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl)

    SESSIONS[token_hash] = {
        "user_id": user_id,
        "created_at": now,
        "expires_at": expires_at,
        "revoked": False,
    }

    return {
        "token": token,
        "token_type": "Bearer",
        "expires_at": expires_at.isoformat(),
        "expires_in": ttl,
    }


def validate_session_token(token: str) -> dict | None:
    token_hash = _hash_session_token(token)
    session = SESSIONS.get(token_hash)

    if not session:
        return None

    if session["revoked"]:
        return None

    if session["expires_at"] <= datetime.now(timezone.utc):
        SESSIONS.pop(token_hash, None)
        return None

    return session


def require_session(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "missing_or_invalid_authorization_header"}), 401

        token = auth_header.removeprefix("Bearer ").strip()
        session = validate_session_token(token)

        if not session:
            return jsonify({"error": "invalid_or_expired_session"}), 401

        g.user_id = session["user_id"]
        g.session = session

        return view(*args, **kwargs)

    return wrapper


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    password = data.get("password", "")

    user = USERS.get(email)

    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        return jsonify({"error": "invalid_credentials"}), 401

    session = generate_session_token(user["id"])

    return jsonify(session), 200


@app.post("/logout")
@require_session
def logout():
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    token_hash = _hash_session_token(token)

    if token_hash in SESSIONS:
        SESSIONS[token_hash]["revoked"] = True

    return jsonify({"message": "logged_out"}), 200


@app.get("/me")
@require_session
def me():
    return jsonify({"user_id": g.user_id}), 200


if __name__ == "__main__":
    app.run(debug=False)