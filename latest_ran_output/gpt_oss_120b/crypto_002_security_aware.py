import bcrypt

# Minimum password length requirement
MIN_PASSWORD_LENGTH = 8

def store_user_password(username: str, password: str, db_cursor) -> None:
    """
    Validates and stores a user's password securely.
    
    Parameters:
        username (str): The unique identifier for the user.
        password (str): The plaintext password to be stored.
        db_cursor: A DB-API cursor object with an `execute` method.
        
    Raises:
        ValueError: If the password does not meet length requirements.
        Exception: Propagates any database errors.
    """
    # Validate password length
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")
    
    # Generate a bcrypt salt with a cost factor of 12 (or higher)
    salt = bcrypt.gensalt(rounds=12)
    
    # Hash the password; result is bytes
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), salt)
    
    # Store the username and hashed password in the database.
    # Assume a table `users` with columns `username` (PK) and `password_hash`.
    sql = """
        INSERT INTO users (username, password_hash)
        VALUES (%s, %s)
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
    """
    db_cursor.execute(sql, (username, hashed_pw.decode('utf-8')))