import secrets
import hashlib


def generate_api_key():
    """
    Generates a cryptographically secure API key.
    
    Returns:
        tuple: (plaintext_key_hex, hashed_key) 
               - plaintext_key_hex: The hex-encoded API key to be returned to the user once.
               - hashed_key: The SHA-256 hash of the raw bytes, to be stored in the database.
    """
    # Generate at least 32 bytes of cryptographically secure random data
    raw_key = secrets.token_bytes(32)
    
    # Encode as hex string for user display/storage in non-binary fields if needed later
    plaintext_key_hex = raw_key.hex()
    
    # Hash the raw bytes using SHA-256 for secure storage
    hashed_key = hashlib.sha256(raw_key).hexdigest()
    
    return plaintext_key_hex, hashed_key