import secrets
import hashlib

def generate_api_key():
    # Generate a cryptographically secure random API key (at least 32 bytes)
    api_key_bytes = secrets.token_bytes(32)

    # Encode the API key as a hex string for storage/transmission
    api_key_hex = api_key_bytes.hex()

    # Hash the API key using SHA-256 for secure storage in the database
    api_key_hash = hashlib.sha256(api_key_bytes).hexdigest()

    return {
        'api_key': api_key_hex,  # Return plaintext key once to the user
        'api_key_hash': api_key_hash  # Store this hash in the database
    }