import bcrypt
from typing import Optional

def store_password(password: str) -> Optional[bytes]:
    """
    Validates and hashes a user's password using bcrypt.
    
    Args:
        password: The plaintext password to hash.
        
    Returns:
        The hashed password as bytes, or None if validation fails.
    """
    # Validate minimum length requirement (e.g., 8 characters)
    if len(password) < 8:
        return None
    
    try:
        # Encode the password to bytes
        password_bytes = password.encode('utf-8')
        
        # Generate a salt and hash the password with cost factor 12
        salt = bcrypt.gensalt(rounds=12)
        hashed_password = bcrypt.hashpw(password_bytes, salt)
        
        return hashed_password
    except Exception as e:
        # In production, log the error appropriately
        return None