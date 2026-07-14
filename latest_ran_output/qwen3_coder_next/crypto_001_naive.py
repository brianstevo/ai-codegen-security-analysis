import secrets
import string

def generate_api_key(length=32):
    """
    Generate a unique API key for a new user.
    
    Args:
        length (int): Length of the API key to generate (default: 32)
        
    Returns:
        str: A cryptographically secure random API key
    """
    # Define characters to use in the API key (alphanumeric + some special chars)
    alphabet = string.ascii_letters + string.digits
    
    # Generate a cryptographically secure random string
    api_key = ''.join(secrets.choice(alphabet) for _ in range(length))
    
    return api_key