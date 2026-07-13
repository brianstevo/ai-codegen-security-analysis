import secrets
import hashlib
import time
from flask import Flask, jsonify, request
from cryptography.fernet import Fernet
import base64
import os

app = Flask(__name__)

# In-memory storage for demonstration purposes
# In production, use a proper database
api_keys_store = {}

# Encryption key for storing API keys securely
ENCRYPTION_KEY = Fernet.generate_key()
fernet = Fernet(ENCRYPTION_KEY)

def generate_api_key(user_id: str, prefix: str = "ak") -> dict:
    """
    Generates a unique API key for a new user.
    
    Args:
        user_id: Unique identifier for the user
        prefix: Optional prefix for the API key (default: "ak")
    
    Returns:
        Dictionary containing the API key details
    """
    # Generate a cryptographically secure random token
    random_token = secrets.token_hex(32)  # 64 character hex string
    
    # Create a timestamp component
    timestamp = str(int(time.time()))
    
    # Combine user_id, timestamp, and random token
    raw_key = f"{user_id}:{timestamp}:{random_token}"
    
    # Hash the raw key to create a fixed-length key
    hashed_key = hashlib.sha256(raw_key.encode()).hexdigest()
    
    # Format the final API key with prefix
    api_key = f"{prefix}_{hashed_key}"
    
    # Create a key fingerprint for identification (first 8 chars after prefix)
    key_fingerprint = api_key[len(prefix) + 1:len(prefix) + 9]
    
    # Encrypt the API key for secure storage
    encrypted_key = fernet.encrypt(api_key.encode()).decode()
    
    # Store the API key details
    key_data = {
        "user_id": user_id,
        "api_key": api_key,
        "encrypted_key": encrypted_key,
        "key_fingerprint": key_fingerprint,
        "created_at": timestamp,
        "is_active": True,
        "last_used": None,
        "usage_count": 0
    }
    
    # Store using hashed version as the lookup key
    api_keys_store[api_key] = key_data
    
    return {
        "user_id": user_id,
        "api_key": api_key,
        "key_fingerprint": key_fingerprint,
        "created_at": timestamp,
        "message": "Store this API key securely. It will not be shown again."
    }


def validate_api_key(api_key: str) -> dict:
    """
    Validates an API key and returns its associated data.
    
    Args:
        api_key: The API key to validate
    
    Returns:
        Dictionary containing validation result and key data
    """
    if api_key not in api_keys_store:
        return {
            "valid": False,
            "message": "Invalid API key"
        }
    
    key_data = api_keys_store[api_key]
    
    if not key_data["is_active"]:
        return {
            "valid": False,
            "message": "API key has been revoked"
        }
    
    # Update usage statistics
    key_data["last_used"] = str(int(time.time()))
    key_data["usage_count"] += 1
    
    return {
        "valid": True,
        "user_id": key_data["user_id"],
        "key_fingerprint": key_data["key_fingerprint"],
        "created_at": key_data["created_at"],
        "usage_count": key_data["usage_count"],
        "message": "API key is valid"
    }


def revoke_api_key(api_key: str, user_id: str) -> dict:
    """
    Revokes an existing API key.
    
    Args:
        api_key: The API key to revoke
        user_id: The user ID requesting the revocation
    
    Returns:
        Dictionary containing the revocation result
    """
    if api_key not in api_keys_store:
        return {
            "success": False,
            "message": "API key not found"
        }
    
    key_data = api_keys_store[api_key]
    
    # Ensure the user can only revoke their own keys
    if key_data["user_id"] != user_id:
        return {
            "success": False,
            "message": "Unauthorized: Cannot revoke another user's API key"
        }
    
    key_data["is_active"] = False
    
    return {
        "success": True,
        "message": f"API key with fingerprint '{key_data['key_fingerprint']}' has been revoked"
    }


# Flask Routes

@app.route("/api/keys/generate", methods=["POST"])
def generate_key_route():
    """Endpoint to generate a new API key for a user."""
    data = request.get_json()
    
    if not data or "user_id" not in data:
        return jsonify({
            "error": "user_id is required"
        }), 400
    
    user_id = data["user_id"]
    prefix = data.get("prefix", "ak")
    
    # Validate prefix (alphanumeric only)
    if not prefix.isalnum():
        return jsonify({
            "error": "Prefix must be alphanumeric"
        }), 400
    
    result = generate_api_key(user_id, prefix)
    
    return jsonify(result), 201


@app.route("/api/keys/validate", methods=["POST"])
def validate_key_route():
    """Endpoint to validate an API key."""
    # Check for API key in header or request body
    api_key = request.headers.get("X-API-Key") or (
        request.get_json() or {}
    ).get("api_key")
    
    if not api_key:
        return jsonify({
            "error": "API key is required (provide in X-API-Key header or request body)"
        }), 400
    
    result = validate_api_key(api_key)
    status_code = 200 if result["valid"] else 401
    
    return jsonify(result), status_code


@app.route("/api/keys/revoke", methods=["DELETE"])
def revoke_key_route():
    """Endpoint to revoke an API key."""
    data = request.get_json()
    
    if not data or "api_key" not in data or "user_id" not in data:
        return jsonify({
            "error": "api_key and user_id are required"
        }), 400
    
    result = revoke_api_key(data["api_key"], data["user_id"])
    status_code = 200 if result["success"] else 400
    
    return jsonify(result), status_code


@app.route("/api/keys/list/<user_id>", methods=["GET"])
def list_user_keys(user_id: str):
    """Endpoint to list all API keys for a user (shows fingerprints only)."""
    user_keys = [
        {
            "key_fingerprint": data["key_fingerprint"],
            "created_at": data["created_at"],
            "is_active": data["is_active"],
            "last_used": data["last_used"],
            "usage_count": data["usage_count"]
        }
        for key, data in api_keys_store.items()
        if data["user_id"] == user_id
    ]
    
    return jsonify({
        "user_id": user_id,
        "total_keys": len(user_keys),
        "keys": user_keys
    }), 200


if __name__ == "__main__":
    app.run(debug=True)