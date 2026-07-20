```python
import secrets
import hashlib
import hmac
import time
from flask import Flask, request, jsonify
from cryptography.fernet import Fernet
import base64
import os

app = Flask(__name__)

# Secret key for HMAC signing (in production, load from environment variable)
SECRET_KEY = os.environ.get("SECRET_KEY", secrets.token_hex(32))

# Encryption key for sensitive data (in production, load from environment variable)
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", Fernet.generate_key())

# Simulated in-memory database for API keys (use a real DB in production)
api_key_store = {}


def generate_api_key(user_id: str, prefix: str = "sk") -> dict:
    """
    Generates a unique, secure API key for a new user.

    Args:
        user_id: A unique identifier for the user.
        prefix: A prefix for the API key (e.g., 'sk' for secret key).

    Returns:
        A dictionary containing:
            - api_key: The full API key to be given to the user (shown only once).
            - api_key_hash: The hashed version stored in the database.
            - key_id: A unique identifier for the key itself.
            - created_at: Timestamp of creation.
    """
    # Generate a cryptographically secure random token
    raw_token = secrets.token_urlsafe(32)

    # Generate a unique key ID
    key_id = secrets.token_hex(8)

    # Create timestamp
    created_at = int(time.time())

    # Construct the full API key with prefix and key_id for easy identification
    # Format: prefix_keyid_rawtoken
    full_api_key = f"{prefix}_{key_id}_{raw_token}"

    # Create an HMAC signature of the full API key
    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        full_api_key.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    # Append signature to the key for integrity verification
    signed_api_key = f"{full_api_key}.{signature[:16]}"

    # Hash the API key for secure storage using SHA-256 with salt
    salt = secrets.token_hex(16)
    api_key_hash = hashlib.pbkdf2_hmac(
        "sha256",
        signed_api_key.encode("utf-8"),
        salt.encode("utf-8"),
        iterations=100000
    ).hex()

    # Store the hashed key with metadata (never store the plain key)
    api_key_store[key_id] = {
        "user_id": user_id,
        "key_id": key_id,
        "api_key_hash": api_key_hash,
        "salt": salt,
        "created_at": created_at,
        "is_active": True,
        "last_used": None,
    }

    return {
        "api_key": signed_api_key,    # Return to user ONCE, never store this
        "key_id": key_id,
        "created_at": created_at,
        "message": "Store this API key securely. It will not be shown again."
    }


def verify_api_key(api_key: str) -> dict:
    """
    Verifies an API key against stored hashes.

    Args:
        api_key: The API key provided by the user.

    Returns:
        A dictionary with verification result and user data if valid.
    """
    try:
        # Extract components from the API key
        parts = api_key.split("_")
        if len(parts) < 3:
            return {"valid": False, "error": "Invalid API key format"}

        key_id = parts[1]

        # Check if key_id exists in store
        if key_id not in api_key_store:
            return {"valid": False, "error": "API key not found"}

        stored_data = api_key_store[key_id]

        # Check if key is active
        if not stored_data["is_active"]:
            return {"valid": False, "error": "API key is inactive or revoked"}

        # Verify the HMAC signature
        key_parts = api_key.rsplit(".", 1)
        if len(key_parts) != 2:
            return {"valid": False, "error": "Invalid API key signature format"}

        original_key, provided_signature = key_parts

        expected_signature = hmac.new(
            SECRET_KEY.encode("utf-8"),
            original_key.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()[:16]

        if not hmac.compare_digest(provided_signature, expected_signature):
            return {"valid": False, "error": "Invalid API key signature"}

        # Recompute hash and compare with stored hash
        salt = stored_data["salt"]
        computed_hash = hashlib.pbkdf2_hmac(
            "sha256",
            api_key.encode("utf-8"),
            salt.encode("utf-8"),
            iterations=100000
        ).hex()

        if not hmac.compare_digest(computed_hash, stored_data["api_key_hash"]):
            return {"valid": False, "error": "API key hash mismatch"}

        # Update last used timestamp
        api_key_store[key_id]["last_used"] = int(time.time())

        return {
            "valid": True,
            "user_id": stored_data["user_id"],
            "key_id": key_id,
            "created_at": stored_data["created_at"],
        }

    except Exception as e:
        return {"valid": False, "error": f"Verification error: {str(e)}"}


def revoke_api_key(key_id: str, user_id: str) -> dict:
    """
    Revokes (deactivates) an API key.

    Args:
        key_id: The ID of the key to revoke.
        user_id: The user ID requesting revocation (for authorization).

    Returns:
        A dictionary with the revocation result.
    """
    if key_id not in api_key_store:
        return {"success": False, "error": "API key not found"}

    stored_data = api_key_store[key_id]

    # Ensure the user owns this key
    if stored_data["user_id"] != user_id:
        return {"success": False, "error": "Unauthorized: Key does not belong to this user"}

    # Revoke the key
    api_key_store[key_id]["is_active"] = False

    return {
        "success": True,
        "message": f"API key {key_id} has been successfully revoked."
    }


# ─── Flask Routes ─────────────────────────────────────────────────────────────

@app.route("/api/keys/generate", methods=["POST"])
def generate_key_route():
    """Endpoint to generate a new API key for a user."""
    data = request.get_json()

    if not data or "user_id" not in data:
        return jsonify({"error": "user_id is required"}), 400

    user_id = data["user_id"]
    prefix = data.get("prefix", "sk")

    # Validate prefix (alphanumeric only)
    if not prefix.isalnum() or len(prefix) > 10:
        return jsonify({"error": "Invalid prefix. Must be alphanumeric and max 10 characters."}), 400

    result = generate_api_key(user_id=user_id, prefix=prefix)
    return jsonify(result), 201


@app.route("/api/keys/verify", methods=["POST"])
def verify_key_route():
    """Endpoint to verify an API key."""
    data = request.get_json()

    if not data or "api_key" not in data:
        return jsonify({"error": "api_key is required"}), 400

    result = verify_api_key(api_key=data["api_key"])

    if result["valid"]:
        return jsonify(result), 200
    else:
        return jsonify(result), 401