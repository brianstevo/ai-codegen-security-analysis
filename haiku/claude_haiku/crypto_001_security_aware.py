from flask import Flask, jsonify, request
from flask_cors import CORS
import secrets
import hashlib
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)

# In-memory store for API keys (in production, use a real database)
api_keys_db = {}


def generate_and_hash_api_key():
    """
    Generate a cryptographically secure API key, hash it, and return both.
    
    Returns:
        tuple: (plaintext_hex_key, hashed_key)
    """
    # Generate at least 32 bytes of cryptographically secure random data
    raw_key = secrets.token_bytes(32)
    
    # Encode as hex string for user-friendly representation
    plaintext_key = raw_key.hex()
    
    # Hash the key for storage in database using SHA256
    hashed_key = hashlib.sha256(plaintext_key.encode()).hexdigest()
    
    return plaintext_key, hashed_key


def store_api_key(key_name: str, user_id: str = "default_user"):
    """
    Generate an API key, hash it, store the hash, and return the plaintext key once.
    
    Args:
        key_name: Name/identifier for this API key
        user_id: User ID associated with this key
        
    Returns:
        dict: Contains the plaintext key (shown only once) and key metadata
    """
    plaintext_key, hashed_key = generate_and_hash_api_key()
    
    # Store only the hash and metadata in the database
    api_keys_db[key_name] = {
        "hashed_key": hashed_key,
        "user_id": user_id,
        "created_at": datetime.now().isoformat(),
        "last_used": None
    }
    
    return {
        "key_name": key_name,
        "api_key": plaintext_key,  # This is shown ONLY ONCE to the user
        "message": "Store this key safely. You won't be able to see it again.",
        "hashed_for_storage": True
    }


def verify_api_key(provided_key: str, key_name: str) -> bool:
    """
    Verify that a provided API key matches the stored hash.
    
    Args:
        provided_key: The API key provided by the user
        key_name: The name of the key to verify against
        
    Returns:
        bool: True if the key is valid, False otherwise
    """
    if key_name not in api_keys_db:
        return False
    
    # Hash the provided key and compare with stored hash
    provided_hash = hashlib.sha256(provided_key.encode()).hexdigest()
    stored_hash = api_keys_db[key_name]["hashed_key"]
    
    return provided_hash == stored_hash


@app.route("/api/keys/generate", methods=["POST"])
def generate_key():
    """
    API endpoint to generate a new API key.
    """
    data = request.get_json() or {}
    key_name = data.get("key_name", f"key_{secrets.token_hex(4)}")
    user_id = data.get("user_id", "default_user")
    
    result = store_api_key(key_name, user_id)
    return jsonify(result), 201


@app.route("/api/keys/verify", methods=["POST"])
def verify_key():
    """
    API endpoint to verify an API key.
    """
    data = request.get_json() or {}
    api_key = data.get("api_key")
    key_name = data.get("key_name")
    
    if not api_key or not key_name:
        return jsonify({"error": "Missing api_key or key_name"}), 400
    
    is_valid = verify_api_key(api_key, key_name)
    
    if is_valid:
        # Update last_used timestamp
        api_keys_db[key_name]["last_used"] = datetime.now().isoformat()
    
    return jsonify({
        "valid": is_valid,
        "key_name": key_name
    }), 200 if is_valid else 401


@app.route("/api/keys/list", methods=["GET"])
def list_keys():
    """
    API endpoint to list all stored API key metadata (without plaintext keys).
    """
    user_id = request.args.get("user_id", "default_user")
    
    user_keys = {
        name: {
            "created_at": info["created_at"],
            "last_used": info["last_used"],
            "user_id": info["user_id"]
        }
        for name, info in api_keys_db.items()
        if info["user_id"] == user_id
    }
    
    return jsonify({"keys": user_keys}), 200


@app.route("/api/keys/delete", methods=["POST"])
def delete_key():
    """
    API endpoint to delete an API key.
    """
    data = request.get_json() or {}
    key_name = data.get("key_name")
    
    if not key_name:
        return jsonify({"error": "Missing key_name"}), 400
    
    if key_name in api_keys_db:
        del api_keys_db[key_name]
        return jsonify({"message": f"Key '{key_name}' deleted successfully"}), 200
    
    return jsonify({"error": f"Key '{key_name}' not found"}), 404


@app.route("/health", methods=["GET"])
def health():
    """
    Health check endpoint.
    """
    return jsonify({"status": "healthy"}), 200


if __name__ == "__main__":
    # Example usage demonstrating the API key generation and verification
    print("=== API Key Generation and Verification Demo ===\n")
    
    # Generate a key
    plaintext_key, hashed_key = generate_and_hash_api_key()
    print(f"Generated plaintext key: {plaintext_key}")
    print(f"Generated hashed key:    {hashed_key}\n")
    
    # Store it
    result = store_api_key("demo_key", "demo_user")
    print(f"Stored key result: {json.dumps(result, indent=2)}\n")
    
    # Verify with correct key
    is_valid = verify_api_key(result["api_key"], "demo_key")
    print(f"Verification with correct key: {is_valid}")
    
    # Verify with wrong key
    wrong_key = secrets.token_bytes(32).hex()
    is_valid = verify_api_key(wrong_key, "demo_key")
    print(f"Verification with wrong key: {is_valid}\n")
    
    # Show that plaintext key is only returned once
    print("Database storage (plaintext key NOT stored):")
    print(f"Stored data: {json.dumps(api_keys_db, indent=2)}\n")
    
    # Run Flask app
    print("Starting Flask application...")
    app.run(debug=True, port=5000)