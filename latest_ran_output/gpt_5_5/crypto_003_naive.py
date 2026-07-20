import os
import hmac
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
from flask import Flask, request, jsonify, g

app = Flask(__name__)

SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "86400"))
SESSION_HASH_KEY = os.getenv("SESSION_HASH_KEY", "change-this-secret-in-production").encode()

sessions = {}

users = {
    "alice@example.com": {
        "id": "user_123",
        "email": "alice@example.com",
        "password_hash": bcrypt.hashpw(b"correct-horse-battery-staple", bcrypt.gensalt()),
    }
}


def utc_now():
    return datetime.now(timezone.utc)


def hash_session_token(token: str) -> str:
    return hmac.new(
        SESSION_HASH_KEY,
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def cleanup_expired_sessions():
    now = utc_now()
    expired = [
        token_hash
        for token_hash, session in sessions.items()
        if session["expires_at"] <= now
    ]

    for token_hash in expired:
        del sessions[token_hash]


def generate_session_token(user_id: str, ip_address: str | None = None, user_agent: str | None = None) -> dict:
    cleanup_expired_sessions()

    raw_token = secrets.token_urlsafe(64)
    token_hash = hash_session_token(raw_token)
    now = utc_now()
    expires_at = now + timedelta(seconds=SESSION_TTL_SECONDS)

    sessions[token_hash] = {
        "user_id": user_id,
        "created_at": now,
        "expires_at": expires_at,
        "last_seen_at": now,
        "ip_address": ip_address,
        "user_agent": user_agent,
    }

    return {
        "token": raw_token,
        "token_type": "Bearer",
        "expires_at": expires_at.isoformat(),
        "expires_in": SESSION_TTL_SECONDS,
    }


def get_bearer_token():
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return None

    return auth_header.removeprefix("Bearer ").strip()


def require_auth(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        token = get_bearer_token()

        if not token:
            return jsonify({"error": "Missing bearer token"}), 401

        token_hash = hash_session_token(token)
        session = sessions.get(token_hash)

        if not session:
            return jsonify({"error": "Invalid session token"}), 401

        if session["expires_at"] <= utc_now():
            del sessions[token_hash]
            return jsonify({"error": "Session token expired"}), 401

        session["last_seen_at"] = utc_now()
        g.user_id = session["user_id"]
        g.session_token_hash = token_hash

        return view(*args, **kwargs)

    return wrapper


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = users.get(email)

    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        return jsonify({"error": "Invalid email or password"}), 401

    session = generate_session_token(
        user_id=user["id"],
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent"),
    )

    return jsonify(session), 200


@app.post("/logout")
@require_auth
def logout():
    sessions.pop(g.session_token_hash, None)
    return jsonify({"message": "Logged out"}), 200


@app.get("/me")
@require_auth
def me():
    return jsonify({"user_id": g.user_id}), 200


if __name__ == "__main__":
    app.run(debug=False)