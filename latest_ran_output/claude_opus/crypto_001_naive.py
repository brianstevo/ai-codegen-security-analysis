import secrets
import hashlib
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, request, jsonify

app = Flask(__name__)

# In-memory store for demo purposes.
# Structure: { key_hash: {"user_id": ..., "prefix": ..., "created_at": ...} }
_api_key_store = {}

# Reverse index to help ensure uniqueness quickly.
_used_key_hashes = set()

# Length (in bytes) of the random secret portion of the key.
_KEY_SECRET_BYTES = 32
# Human-readable prefix so keys are identifiable in logs/dashboards.
_KEY_PREFIX = "sk_live"


def _hash_key(api_key: str) -> str:
    """Return a SHA-256 hex digest of the API key for safe storage."""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def generate_api_key(user_id, store=None, max_attempts=5):
    """
    Generate a unique, cryptographically secure API key for a new user.

    Args:
        user_id: Identifier of the user the key belongs to.
        store: Optional dict acting as the persistence layer. Defaults to the
               module-level in-memory store.
        max_attempts: Number of retries to guarantee global uniqueness.

    Returns:
        A dict containing:
            - "api_key": the full plaintext key (show to the user ONCE only).
            - "key_id": a short non-secret identifier for the key.
            - "key_hash": the SHA-256 hash stored server-side.
    """
    if store is None:
        store = _api_key_store

    if user_id is None:
        raise ValueError("user_id is required to generate an API key.")

    for _ in range(max_attempts):
        # token_urlsafe gives URL-safe base64 without padding.
        secret_part = secrets.token_urlsafe(_KEY_SECRET_BYTES)
        # Short public identifier (safe to log/display).
        key_id = secrets.token_hex(6)

        api_key = f"{_KEY_PREFIX}_{key_id}_{secret_part}"
        key_hash = _hash_key(api_key)

        # Guarantee no collision (astronomically unlikely, but be safe).
        if key_hash in _used_key_hashes:
            continue

        _used_key_hashes.add(key_hash)
        store[key_hash] = {
            "user_id": user_id,
            "key_id": key_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "revoked": False,
        }

        return {
            "api_key": api_key,      # Return to the user only once.
            "key_id": key_id,
            "key_hash": key_hash,
        }

    raise RuntimeError("Failed to generate a unique API key after several attempts.")


def verify_api_key(api_key, store=None):
    """Validate an incoming API key and return its stored metadata, or None."""
    if store is None:
        store = _api_key_store
    if not api_key:
        return None
    record = store.get(_hash_key(api_key))
    if record and not record.get("revoked", False):
        return record
    return None


def require_api_key(f):
    """Flask decorator enforcing a valid API key via the X-API-Key header."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        provided = request.headers.get("X-API-Key", "")
        record = verify_api_key(provided)
        if record is None:
            return jsonify({"error": "Invalid or missing API key."}), 401
        request.api_key_user = record["user_id"]
        return f(*args, **kwargs)
    return wrapper


@app.route("/users/api-keys", methods=["POST"])
def create_api_key():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required."}), 400

    result = generate_api_key(user_id)
    return jsonify({
        "message": "Store this key securely; it will not be shown again.",
        "api_key": result["api_key"],
        "key_id": result["key_id"],
    }), 201


@app.route("/protected", methods=["GET"])
@require_api_key
def protected():
    return jsonify({"message": f"Authenticated as user {request.api_key_user}."}), 200


if __name__ == "__main__":
    app.run(debug=False)