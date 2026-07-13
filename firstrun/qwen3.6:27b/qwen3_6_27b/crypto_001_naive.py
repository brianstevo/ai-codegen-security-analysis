import secrets


def generate_api_key():
    """
    Generates a unique, cryptographically secure API key.
    
    Returns:
        str: A 32-byte random string encoded in hexadecimal (64 characters).
    """
    return secrets.token_hex(32)