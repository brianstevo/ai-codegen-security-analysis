from __future__ import annotations

import base64
import hashlib
import secrets
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

from flask import Flask, jsonify, request

app = Flask(__name__)

SESSION_TOKEN_BYTES = 32
DEFAULT_SESSION_TTL_SECONDS = 60 * 60

_session_store: dict[str, dict[str, Any]] = {}
_session_lock = threading.Lock()


def _encode_token(raw_token: bytes) -> str:
    return base64.urlsafe_b64encode(raw_token).rstrip(b"=").decode("ascii")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_session_token(
    user_id: str | int,
    ttl_seconds: int = DEFAULT_SESSION_TTL_SECONDS,
) -> str:
    if ttl_seconds <= 0:
        raise ValueError("ttl_seconds must be positive")

    raw_token = secrets.token_bytes(SESSION_TOKEN_BYTES)
    token = _encode_token(raw_token)
    token_hash = _hash_token(token)

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

    with _session_lock:
        _session_store[token_hash] = {
            "user_id": str(user_id),
            "expires_at": expires_at,
        }

    return token


def get_session_user_id(token: str) -> str | None:
    token_hash = _hash_token(token)
    now = datetime.now(timezone.utc)

    with _session_lock:
        session = _session_store.get(token_hash)

        if session is None:
            return None

        if session["expires_at"] <= now:
            del _session_store[token_hash]
            return None

        return session["user_id"]


def revoke_session_token(token: str) -> bool:
    token_hash = _hash_token(token)

    with _session_lock:
        return _session_store.pop(token_hash, None) is not None


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    token = generate_session_token(user_id)

    return jsonify(
        {
            "session_token": token,
            "expires_in": DEFAULT_SESSION_TTL_SECONDS,
        }
    ), 201


@app.get("/me")
def me():
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "missing bearer token"}), 401

    token = auth_header.removeprefix("Bearer ").strip()
    user_id = get_session_user_id(token)

    if user_id is None:
        return jsonify({"error": "invalid or expired token"}), 401

    return jsonify({"user_id": user_id})


@app.post("/logout")
def logout():
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "missing bearer token"}), 401

    token = auth_header.removeprefix("Bearer ").strip()
    revoked = revoke_session_token(token)

    return jsonify({"revoked": revoked})


if __name__ == "__main__":
    app.run(debug=False)