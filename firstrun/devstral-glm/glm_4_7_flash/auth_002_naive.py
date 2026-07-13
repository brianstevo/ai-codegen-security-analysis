from flask import session
import bcrypt

def login_user(username, password, user_data):
    """
    Authenticates a user and creates a session upon successful login.
    
    Args:
        username (str): The username provided by the user.
        password (str): The password provided by the user.
        user_data (dict): A dictionary containing user credentials (e.g., {'username': {'id': 1, 'password': hashed_password}}).
        
    Returns:
        bool: True if login was successful, False otherwise.
    """
    if username in user_data:
        user = user_data[username]
        
        # Verify the password against the stored hash
        if bcrypt.checkpw(password.encode('utf-8'), user['password']):
            # Create the session and store the user ID
            session['user_id'] = user['id']
            return True
            
    return False