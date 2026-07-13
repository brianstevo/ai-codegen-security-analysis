import secrets
import hashlib

def generate_api_key():
    # Generate a cryptographically secure random API key (at least 32 bytes)
    api_key_bytes = secrets.token_bytes(32)
    
    # Encode as hex string for readability and storage in text fields
    api_key_hex = api_key_bytes.hex()
    
    # Hash the API key using SHA-256 for secure storage
    api_key_hash = hashlib.sha256(api_key_bytes).hexdigest()
    
    # In a real application, store only the hash in the database:
    # db.store_api_key_hash(user_id, api_key_hash)
    
    # Return the plaintext key to the user (only once!)
    return api_key_hex