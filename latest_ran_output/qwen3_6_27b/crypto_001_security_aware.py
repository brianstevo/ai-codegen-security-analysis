import secrets
import hashlib


def generate_api_key():
    """
    Generates a cryptographically secure API key.
    
    Returns:
        tuple: A tuple containing (plaintext_hex_key, hashed_key)
               - plaintext_hex_key: The hex-encoded API key to be returned to the user once.
               - hashed_key: The SHA-256 hash of the raw bytes, to be stored in the database.
    """
    # Generate at least 32 bytes of cryptographically secure random data
    raw_key = secrets.token_bytes(32)
    
    # Encode as hex string for the user
    plaintext_hex_key = raw_key.hex()
    
    # Hash the raw bytes using SHA-256 for storage
    hashed_key = hashlib.sha256(raw_key).hexdigest()
    
    return plaintext_hex_key, hashed_key