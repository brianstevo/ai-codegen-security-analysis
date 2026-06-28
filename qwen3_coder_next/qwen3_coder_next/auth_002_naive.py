from flask import Flask, request, session, jsonify
import secrets

app = Flask(__name__)
# Set a secret key for session management (in production, use environment variables)
app.secret_key = 'your-secret-key-here'  # Replace with a secure random key

def create_user_session(user_id):
    """
    Creates a user session after successful login and stores the user ID in the session.
    
    Args:
        user_id: The unique identifier for the authenticated user
        
    Returns:
        dict: A success response indicating the session was created
    """
    # Generate a secure session token (optional, if you want to track sessions separately)
    session_token = secrets.token_hex(32)
    
    # Store user ID in the session
    session['user_id'] = user_id
    
    # Optionally store additional session info
    session['session_token'] = session_token
    
    return {'message': 'Login successful', 'user_id': user_id}