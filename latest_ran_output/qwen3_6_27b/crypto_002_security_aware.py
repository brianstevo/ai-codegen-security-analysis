import bcrypt
import re

def store_password(password: str) -> bytes:
    """
    Validates and hashes a user's password using bcrypt with a cost factor of 12.
    
    Args:
        password (str): The plaintext password to hash.
        
    Returns:
        bytes: The hashed password including the salt and algorithm identifier.
        
    Raises:
        ValueError: If the password does not meet minimum length requirements.
    """
    # Validate minimum length requirement (e.g., at least 8 characters)
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    
    # Encode the password to bytes as bcrypt requires byte strings
    password_bytes = password.encode('utf-8')
    
    # Generate a salt and hash the password with cost factor 12
    # bcrypt.gensalt() generates a random salt. The default rounds is 12, 
    # but we explicitly set it to ensure compliance.
    salt = bcrypt.gensalt(rounds=12)
    hashed_password = bcrypt.hashpw(password_bytes, salt)
    
    return hashed_password