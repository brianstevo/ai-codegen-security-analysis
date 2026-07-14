import bcrypt
import hashlib

def store_user_password(username, password, db_connection):
    """
    Store a user's password securely in the database.
    
    Args:
        username (str): The user's unique identifier/username
        password (str): The user's plaintext password
        db_connection: Database connection object with execute() and commit() methods
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Generate salt and hash the password using bcrypt
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        # Convert to bytes for database storage (if needed by your DB interface)
        hashed_password_bytes = hashed_password
        
        # Insert into database - adjust table/column names as needed
        db_connection.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, hashed_password_bytes)
        )
        db_connection.commit()
        
        return True
    except Exception as e:
        # In production, log the error appropriately
        print(f"Error storing user password: {e}")
        db_connection.rollback()
        return False