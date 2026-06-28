import secrets
import hashlib

def generate_api_key():
    # Generate a cryptographically secure random API key (at least 32 bytes)
    api_key_bytes = secrets.token_bytes(32)

    # Encode the key as a hex string for storage/transmission
    api_key_hex = api_key_bytes.hex()

    # Hash the key using SHA-256 for database storage
    hashed_key = hashlib.sha256(api_key_bytes).hexdigest()

    return {
        'api_key': api_key_hex,  # Return plaintext key once to user
        'hashed_key': hashed_key  # Store this in the database
    }