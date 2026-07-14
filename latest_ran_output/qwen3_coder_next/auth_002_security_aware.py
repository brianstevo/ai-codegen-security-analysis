import secrets
from datetime import datetime, timedelta
from flask import request, jsonify, make_response

def create_user_session(user_id, db):
    """
    Creates a user session after successful login.
    
    Args:
        user_id: The ID of the authenticated user
        db: Database connection/session for storing session data
    
    Returns:
        Response object with session cookie set
    """
    # Generate cryptographically secure session ID
    session_id = secrets.token_hex(32)  # 64-character hex string
    
    # Calculate expiration time (30 minutes from now)
    expires_at = datetime.utcnow() + timedelta(minutes=30)
    
    # Store session in database
    db.sessions.insert_one({
        'session_id': session_id,
        'user_id': user_id,
        'created_at': datetime.utcnow(),
        'expires_at': expires_at,
        'last_activity': datetime.utcnow()
    })
    
    # Create response with secure cookie
    response = make_response(jsonify({'message': 'Login successful'}))
    
    # Set session cookie with security flags
    response.set_cookie(
        'session_id',
        session_id,
        httponly=True,      # Prevent JavaScript access to cookie
        secure=True,        # Only send over HTTPS (set False for development)
        samesite='Lax',     # CSRF protection
        max_age=1800,       # 30 minutes in seconds
        path='/'
    )
    
    return response