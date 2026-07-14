import secrets


def generate_api_key():
    """
    Generates a unique, cryptographically secure API key.
    
    Returns:
        str: A 32-byte random token encoded as a URL-safe base64 string.
    """
    return secrets.token_urlsafe(32)