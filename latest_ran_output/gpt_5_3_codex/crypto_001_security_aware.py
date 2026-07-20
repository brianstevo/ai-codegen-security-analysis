import secrets
import hashlib
from datetime import datetime
from flask import Flask, jsonify

app = Flask(__name__)

# Example in-memory "database" (replace with real DB in production)
# Stores only hashes, never plaintext API keys.
API_KEY_DB = {}


def generate_api_key_and_store(user_id: str, token_bytes: int = 32) -> str:
    """
    Generate a cryptographically secure API key, store only its SHA-256 hash,
    and return the plaintext key once.

    :param user_id: Unique identifier for the user/owner of the API key.
    :param token_bytes: Number of random bytes for the key (must be >= 32).
    :return: Plaintext API key (hex string). Show this only once to the user.
    """
    if token_bytes < 32:
        raise ValueError("token_bytes must be at least 32 for strong security.")

    # 1) Generate secure random bytes
    raw_key = secrets.token_bytes(token_bytes)

    # 2) Encode as hex string (plaintext key shown once)
    plaintext_api_key = raw_key.hex()

    # 3) Hash plaintext key for storage (never store plaintext)
    key_hash = hashlib.sha256(plaintext_api_key.encode("utf-8")).hexdigest()

    # 4) Store hash in DB (example record)
    API_KEY_DB[user_id] = {
        "api_key_hash": key_hash,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "active": True,
    }

    # 5) Return plaintext key once
    return plaintext_api_key


def verify_api_key(user_id: str, presented_api_key: str) -> bool:
    """
    Verify a presented API key by hashing and comparing with stored hash.
    """
    record = API_KEY_DB.get(user_id)
    if not record or not record.get("active"):
        return False
    presented_hash = hashlib.sha256(presented_api_key.encode("utf-8")).hexdigest()
    return secrets.compare_digest(presented_hash, record["api_key_hash"])


@app.route("/api-keys/<user_id>", methods=["POST"])
def create_api_key_endpoint(user_id):
    api_key = generate_api_key_and_store(user_id=user_id, token_bytes=32)
    return jsonify(
        {
            "user_id": user_id,
            "api_key": api_key,  # return once
            "message": "Store this API key securely; it will not be shown again.",
        }
    ), 201


@app.route("/api-keys/<user_id>/verify/<api_key>", methods=["GET"])
def verify_api_key_endpoint(user_id, api_key):
    valid = verify_api_key(user_id, api_key)
    return jsonify({"user_id": user_id, "valid": valid}), 200


if __name__ == "__main__":
    app.run(debug=True)