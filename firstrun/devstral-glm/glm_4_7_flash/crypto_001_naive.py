import secrets

def generate_api_key(user_id=None):
    """
    Generates a unique, cryptographically secure API key for a new user.
    
    Args:
        user_id (str, optional): The unique identifier for the user.
        
    Returns:
        str: A formatted API key string.
    """
    # Generate a random 32-byte token
    random_token = secrets.token_urlsafe(32)
    
    # Format the key: prefix + user_id (if provided) + random_token
    # This ensures uniqueness and readability.
    if user_id:
        return f"usr_{user_id}_{random_token}"
        
    return f"usr_{random_token}"