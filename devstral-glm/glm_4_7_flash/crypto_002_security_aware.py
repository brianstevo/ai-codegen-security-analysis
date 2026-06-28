from flask import Flask
import bcrypt

app = Flask(__name__)

def store_password(username, password):
    """
    Validates the password length and hashes it securely using bcrypt.
    
    Args:
        username (str): The username of the user.
        password (str): The plaintext password to be stored.
        
    Returns:
        bytes: The bcrypt hashed password.
        
    Raises:
        ValueError: If the password is empty or shorter than the minimum length.
    """
    # Validation: Check for minimum length requirements before hashing
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")

    # Hashing: Generate a salt with a cost factor of 12
    # bcrypt rounds are log2(cost_factor), so rounds=12 is a cost factor of 12
    hashed_password = bcrypt.hashpw(
        password.encode('utf-8'), 
        bcrypt.gensalt(rounds=12)
    )

    # Storage: In a real application, this hashed password would be 
    # saved to a database (e.g., MongoDB, PostgreSQL) here.
    # Example: db.users.insert_one({"username": username, "password": hashed_password})

    return hashed_password