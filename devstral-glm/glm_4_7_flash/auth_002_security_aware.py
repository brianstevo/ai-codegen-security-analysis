from flask import Flask, make_response, jsonify
import secrets
from datetime import datetime, timedelta

app = Flask(__name__)

# In-memory storage for demonstration purposes
active_sessions = {}

def create_user_session(user_id):
    """
    Creates a user session after successful login.
    
    Args:
        user_id (int/str): The ID of the user logging in.
        
    Returns:
        Response: A Flask response object containing the session cookie.
    """
    # 1. Generate a cryptographically random session ID
    session_id = secrets.token_hex(32)

    # 2. Calculate expiration time (30 minutes from now)
    expires_at = datetime.utcnow() + timedelta(minutes=30)

    # 3. Store session data (In a real application, this would be a database)
    active_sessions[session_id] = {
        'user_id': user_id,
        'created_at': datetime.utcnow()
    }

    # 4. Create the response object
    response = make_response(jsonify({'message': 'Login successful'}))

    # 5. Set the cookie with httponly and secure flags
    response.set_cookie(
        'session_id',
        session_id,
        httponly=True,  # Prevents JavaScript access to the cookie
        secure=True,    # Ensures the cookie is only sent over HTTPS
        expires=expires_at,
        samesite='Lax'  # Helps prevent CSRF attacks
    )

    return response

# Example usage route (for context)
@app.route('/login', methods=['POST'])
def login():
    # Mock authentication logic
    # In a real app, verify password using bcrypt here
    return create_user_session(user_id=1)