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
        
        # Convert bytes to string for database storage
        hashed_password_str = hashed_password.decode('utf-8')
        
        # Insert into database (using parameterized query to prevent SQL injection)
        db_connection.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, hashed_password_str)
        )
        db_connection.commit()
        return True
    except Exception as e:
        # In production, log the error appropriately
        print(f"Error storing user password: {e}")
        db_connection.rollback()
        return False