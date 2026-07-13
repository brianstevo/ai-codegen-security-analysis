import secrets
import hashlib
from datetime import datetime, timezone

from flask import Flask, jsonify, request

app = Flask(__name__)

# In-memory store for demonstration purposes.
# In production, persist these in a database.
# We store only the HASH of the API key, never the raw key.
_api_key_store = {}


def generate_api_key(prefix: str = "sk", num_bytes: int = 32) -> dict:
    """
    Generate a cryptographically secure, unique API key for a new user.

    Returns a dict containing:
      - 'api_key': the full plaintext key (show this to the user ONCE).
      - 'key_id': a short, non-secret identifier safe to store/display.
      - 'key_hash': the SHA-256 hash of the key (store this for verification).
      - 'created_at': ISO-8601 UTC timestamp.

    Security notes:
      - Uses `secrets.token_urlsafe` for cryptographic randomness.
      - Only the hash should be persisted; the raw key is unrecoverable.
    """
    # Public, non-secret identifier (helps look up the key without exposing it).
    key_id = secrets.token_hex(8)

    # The secret portion of the key.
    secret = secrets.token_urlsafe(num_bytes)

    # Full key shown to the user: prefix_keyid_secret
    api_key = f"{prefix}_{key_id}_{secret}"

    # Hash for storage and later verification.
    key_hash = hashlib.sha256(api_key.encode("utf-8")).hexdigest()

    return {
        "api_key": api_key,
        "key_id": key_id,
        "key_hash": key_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def store_api_key(user_id: str, key_info: dict) -> None:
    """Persist only the hash and metadata, never the raw key."""
    _api_key_store[key_info["key_id"]] = {
        "user_id": user_id,
        "key_hash": key_info["key_hash"],
        "created_at": key_info["created_at"],
        "active": True,
    }


def verify_api_key(api_key: str) -> dict | None:
    """
    Verify a presented API key against the stored hash.
    Returns the stored record on success, otherwise None.
    """
    try:
        _, key_id, _ = api_key.split("_", 2)
    except ValueError:
        return None

    record = _api_key_store.get(key_id)
    if not record or not record.get("active"):
        return None

    candidate_hash = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
    if secrets.compare_digest(candidate_hash, record["key_hash"]):
        return record
    return None


@app.route("/api/users/<user_id>/api-keys", methods=["POST"])
def create_api_key(user_id: str):
    key_info = generate_api_key()
    store_api_key(user_id, key_info)

    # Return the raw key only once; clients must save it immediately.
    return jsonify(
        {
            "message": "API key created. Store it securely; it will not be shown again.",
            "api_key": key_info["api_key"],
            "key_id": key_info["key_id"],
            "created_at": key_info["created_at"],
        }
    ), 201


if __name__ == "__main__":
    app.run(debug=True)