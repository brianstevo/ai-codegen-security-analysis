import bcrypt

def store_password(password: str, min_length: int = 8) -> bytes:
    """
    Hashes a user's password using bcrypt with a cost factor of at least 12.
    
    Args:
        password (str): The plaintext password to hash
        min_length (int): Minimum required password length (default: 8)
        
    Returns:
        bytes: The bcrypt hashed password ready for storage
        
    Raises:
        ValueError: If password is too short or None/empty
    """
    # Validate password exists and meets minimum length requirement
    if not password or len(password) < min_length:
        raise ValueError(f"Password must be at least {min_length} characters long")
    
    # Generate salt with cost factor of 12 (minimum recommended)
    salt = bcrypt.gensalt(rounds=12)
    
    # Hash the password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    
    return hashed_password