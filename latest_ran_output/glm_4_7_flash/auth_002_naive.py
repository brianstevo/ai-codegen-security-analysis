from flask import session
import secrets

def create_user_session(user_id):
    """
    Creates a user session and stores the user ID securely.
    
    Args:
        user_id (int): The ID of the user to log in.
        
    Returns:
        str: The generated session token.
    """
    # Generate a secure random token for the session
    session_token = secrets.token_urlsafe(32)
    
    # Store the user ID in the session
    session['user_id'] = user_id
    
    # Store the token for validation
    session['session_token'] = session_token
    
    # Set session to permanent (optional)
    session.permanent = True
    
    return session_token