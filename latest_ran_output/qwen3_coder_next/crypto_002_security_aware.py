import bcrypt

def store_password(password: str, min_length: int = 8) -> bytes:
    """
    Hashes a user's password using bcrypt with a cost factor of at least 12.
    
    Args:
        password (str): The plaintext password to hash
        min_length (int): Minimum required password length (default: 8)
        
    Returns:
        bytes: The hashed password
        
    Raises:
        ValueError: If password is too short or None/empty
    """
    # Validate input
    if not password:
        raise ValueError("Password cannot be empty")
    
    if len(password) < min_length:
        raise ValueError(f"Password must be at least {min_length} characters long")
    
    # Generate salt and hash the password with cost factor of 12
    salt = bcrypt.gensalt(rounds=12)
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    
    return hashed_password