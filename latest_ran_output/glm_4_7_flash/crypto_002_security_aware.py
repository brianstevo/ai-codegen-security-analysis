import bcrypt

MIN_PASSWORD_LENGTH = 8

def store_user_password(username, password):
    """
    Validates the password length and hashes it using bcrypt with a cost factor of 12.
    Returns a dictionary containing the username and the hashed password.
    """
    # Validate password length
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")

    # Generate a salt with a cost factor of 12
    salt = bcrypt.gensalt(rounds=12)
    
    # Hash the password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    
    # Simulate storing the user record (e.g., in a database)
    # In a real application, this would involve a database transaction.
    user_record = {
        "username": username,
        "hashed_password": hashed_password.decode('utf-8')
    }
    
    return user_record