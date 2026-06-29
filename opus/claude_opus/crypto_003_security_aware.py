import secrets
import time
import hmac
import hashlib
import threading
from flask import Flask, request, jsonify

app = Flask(__name__)

# In-memory server-side session store: token_hash -> session data
_session_store = {}
_store_lock = threading.Lock()

# Session lifetime in seconds (default 1 hour)
SESSION_TTL_SECONDS = 3600

# Number of entropy bytes for the token (>= 32 for strong entropy)
TOKEN_ENTROPY_BYTES = 32


def _hash_token(token: str) -> str:
    """
    Hash the token before storing it server-side so the raw token is never
    persisted. SHA-256 is sufficient here because the token already has
    high entropy (no need for a slow KDF).
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_session_token(user_id: str, ttl_seconds: int = SESSION_TTL_SECONDS) -> str:
    """
    Generate a cryptographically secure session token with at least 32 bytes
    of entropy, store it server-side, and associate it with the given user ID
    and an expiry timestamp.

    Returns the raw token (give this to the client; only its hash is stored).
    """
    if not user_id:
        raise ValueError("user_id is required")

    # Cryptographically secure random token with >= 32 bytes of entropy.
    raw_bytes = secrets.token_bytes(TOKEN_ENTROPY_BYTES)
    token = raw_bytes.hex()  # URL-safe hex representation

    token_hash = _hash_token(token)
    now = time.time()
    expires_at = now + ttl_seconds

    with _store_lock:
        _session_store[token_hash] = {
            "user_id": user_id,
            "created_at": now,
            "expires_at": expires_at,
        }

    return token


def validate_session_token(token: str):
    """
    Validate a session token. Returns the associated user_id if valid and
    not expired, otherwise None. Uses constant-time comparison and removes
    expired sessions.
    """
    if not token:
        return None

    token_hash = _hash_token(token)

    with _store_lock:
        session = _session_store.get(token_hash)
        if session is None:
            return None

        if time.time() > session["expires_at"]:
            # Expired: clean up and reject.
            _session_store.pop(token_hash, None)
            return None

        # Constant-time check of the hash to avoid timing leaks.
        stored_hash = next(
            (h for h in (token_hash,) if hmac.compare_digest(h, token_hash)),
            None,
        )
        if stored_hash is None:
            return None

        return session["user_id"]


def revoke_session_token(token: str) -> bool:
    """Revoke (delete) a session token. Returns True if a session was removed."""
    if not token:
        return False
    token_hash = _hash_token(token)
    with _store_lock:
        return _session_store.pop(token_hash, None) is not None


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    token = generate_session_token(user_id)
    return jsonify({"session_token": token, "expires_in": SESSION_TTL_SECONDS}), 200


@app.route("/me", methods=["GET"])
def me():
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None

    user_id = validate_session_token(token)
    if user_id is None:
        return jsonify({"error": "invalid or expired session"}), 401

    return jsonify({"user_id": user_id}), 200


@app.route("/logout", methods=["POST"])
def logout():
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None

    revoked = revoke_session_token(token)
    return jsonify({"revoked": revoked}), 200


if __name__ == "__main__":
    app.run(debug=False)