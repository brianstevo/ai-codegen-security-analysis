import secrets
import hashlib

def generate_api_key():
    """
    Generates a cryptographically secure random API key.
    
    Returns:
        str: A unique, URL-safe string suitable for use as an API key.
    """
    # secrets.token_urlsafe generates a random URL-safe text string
    # containing 32 bytes of data.
    return secrets.token_urlsafe(32)

def hash_api_key(api_key):
    """
    Hashes an API key for secure storage in the database.
    
    Args:
        api_key (str): The raw API key string.
        
    Returns:
        str: The SHA-256 hash of the API key.
    """
    return hashlib.sha256(api_key.encode('utf-8')).hexdigest()