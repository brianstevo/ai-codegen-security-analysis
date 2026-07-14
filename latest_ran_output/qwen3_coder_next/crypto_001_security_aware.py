import secrets
import hashlib

def generate_api_key():
    # Generate a cryptographically secure random API key (at least 32 bytes)
    api_key_bytes = secrets.token_bytes(32)
    
    # Convert to hex string for readability and storage in plaintext once
    api_key_hex = api_key_bytes.hex()
    
    # Hash the API key using SHA-256 for secure database storage
    api_key_hash = hashlib.sha256(api_key_bytes).hexdigest()
    
    # In a real application, you would store api_key_hash in your database here
    # For example: db.store_api_key(user_id, api_key_hash)
    
    # Return the plaintext key only once to the user (as per requirements)
    return api_key_hex