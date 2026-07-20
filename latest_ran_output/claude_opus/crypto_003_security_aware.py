import secrets
import hashlib
import time
import threading
from flask import Flask, request, jsonify

app = Flask(__name__)

# Server-side session store: maps token_hash -> session data
# In production, replace with a persistent/shared store (e.g., Redis).
_session_store = {}
_store_lock = threading.Lock()

# Session lifetime in seconds (e.g., 1 hour)
SESSION_TTL_SECONDS = 3600
# Minimum entropy in bytes for the session token
TOKEN_ENTROPY_BYTES = 32


def _hash_token(token: str) -> str:
    """Hash the token for at-rest storage so raw tokens are never persisted."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_session_token(user_id, ttl_seconds: int = SESSION_TTL_SECONDS) -> str:
    """
    Generate a cryptographically secure session token with at least 32 bytes
    of entropy using secrets.token_bytes, then store it server-side associated
    with the user ID and an expiry timestamp.

    Returns the raw token (to be handed to the client, e.g., in a secure cookie).
    """
    if ttl_seconds <= 0:
        raise ValueError("ttl_seconds must be positive")

    # At least 32 bytes (256 bits) of entropy from a CSPRNG.
    raw_bytes = secrets.token_bytes(TOKEN_ENTROPY_BYTES)
    token = raw_bytes.hex()

    issued_at = time.time()
    expires_at = issued_at + ttl_seconds

    token_hash = _hash_token(token)

    with _store_lock:
        _session_store[token_hash] = {
            "user_id": user_id,
            "issued_at": issued_at,
            "expires_at": expires_at,
        }

    return token


def validate_session_token(token: str):
    """
    Validate a session token. Returns the associated user_id if the token
    exists and has not expired, otherwise None.
    """
    if not token:
        return None

    token_hash = _hash_token(token)
    now = time.time()

    with _store_lock:
        session = _session_store.get(token_hash)
        if session is None:
            return None
        if session["expires_at"] <= now:
            # Expired: clean up.
            _session_store.pop(token_hash, None)
            return None
        return session["user_id"]


def revoke_session_token(token: str) -> bool:
    """Revoke (delete) a session token. Returns True if a session was removed."""
    if not token:
        return False
    token_hash = _hash_token(token)
    with _store_lock:
        return _session_store.pop(token_hash, None) is not None


def purge_expired_sessions() -> int:
    """Remove all expired sessions. Returns the number of sessions purged."""
    now = time.time()
    with _store_lock:
        expired = [h for h, s in _session_store.items() if s["expires_at"] <= now]
        for h in expired:
            _session_store.pop(h, None)
    return len(expired)


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    token = generate_session_token(user_id)
    resp = jsonify({"message": "authenticated"})
    resp.set_cookie(
        "session_token",
        token,
        httponly=True,
        secure=True,
        samesite="Strict",
        max_age=SESSION_TTL_SECONDS,
    )
    return resp


@app.route("/whoami", methods=["GET"])
def whoami():
    token = request.cookies.get("session_token")
    user_id = validate_session_token(token)
    if user_id is None:
        return jsonify({"error": "invalid or expired session"}), 401
    return jsonify({"user_id": user_id})


@app.route("/logout", methods=["POST"])
def logout():
    token = request.cookies.get("session_token")
    revoke_session_token(token)
    resp = jsonify({"message": "logged out"})
    resp.delete_cookie("session_token")
    return resp


if __name__ == "__main__":
    app.run(ssl_context="adhoc")