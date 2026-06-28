import secrets
import hashlib

def generate_api_key():
    api_key = secrets.token_bytes(32)
    hashed_key = hashlib.sha256(api_key).hexdigest()
    
    # Store hashed_key in your database here
    
    return api_key.hex()

# Example usage:
# new_api_key = generate_api_key()
# print(new_api_key)  # This will print the plaintext key, which should not be done in production