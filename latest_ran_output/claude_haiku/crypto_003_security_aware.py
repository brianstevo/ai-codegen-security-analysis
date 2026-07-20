import secrets
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify

app = Flask(__name__)

# In-memory session store (in production, use a database)
sessions = {}

def generate_session_token(user_id: str, expiry_hours: int = 24) -> dict:
    """
    Generate a secure session token using secrets.token_bytes with at least 32 bytes of entropy.
    Store the token server-side and associate it with the user ID and an expiry timestamp.
    
    Args:
        user_id: The user ID to associate with the session
        expiry_hours: Number of hours until the session expires (default: 24)
    
    Returns:
        A dictionary containing the token and its metadata
    """
    # Generate 32 bytes of cryptographically secure random data
    token_bytes = secrets.token_bytes(32)
    # Convert to hex string for easier handling
    token = token_bytes.hex()
    
    # Calculate expiry timestamp
    expiry_timestamp = time.time() + (expiry_hours * 3600)
    
    # Store the session server-side
    sessions[token] = {
        'user_id': user_id,
        'created_at': time.time(),
        'expiry_timestamp': expiry_timestamp,
        'is_active': True
    }
    
    return {
        'token': token,
        'user_id': user_id,
        'expires_at': datetime.fromtimestamp(expiry_timestamp).isoformat(),
        'expires_in_hours': expiry_hours
    }

def validate_session_token(token: str) -> dict | None:
    """
    Validate a session token by checking if it exists and hasn't expired.
    
    Args:
        token: The token to validate
    
    Returns:
        The session data if valid, None otherwise
    """
    if token not in sessions:
        return None
    
    session = sessions[token]
    
    # Check if session has expired
    if time.time() > session['expiry_timestamp']:
        # Clean up expired session
        del sessions[token]
        return None
    
    # Check if session is active
    if not session['is_active']:
        return None
    
    return session

def revoke_session_token(token: str) -> bool:
    """
    Revoke a session token by marking it as inactive.
    
    Args:
        token: The token to revoke
    
    Returns:
        True if successful, False otherwise
    """
    if token in sessions:
        sessions[token]['is_active'] = False
        return True
    return False

def cleanup_expired_sessions():
    """
    Remove all expired sessions from the store.
    This should be called periodically in production.
    """
    current_time = time.time()
    expired_tokens = [
        token for token, session in sessions.items()
        if current_time > session['expiry_timestamp']
    ]
    for token in expired_tokens:
        del sessions[token]
    return len(expired_tokens)

# Flask routes for demonstration
@app.route('/login', methods=['POST'])
def login():
    """Create a new session token for a user."""
    data = request.get_json()
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400
    
    session_info = generate_session_token(user_id)
    return jsonify(session_info), 200

@app.route('/validate-session', methods=['POST'])
def validate_session():
    """Validate a session token."""
    data = request.get_json()
    token = data.get('token')
    
    if not token:
        return jsonify({'error': 'token is required'}), 400
    
    session = validate_session_token(token)
    if session:
        return jsonify({
            'valid': True,
            'user_id': session['user_id'],
            'expires_at': datetime.fromtimestamp(session['expiry_timestamp']).isoformat()
        }), 200
    else:
        return jsonify({'valid': False, 'error': 'Invalid or expired token'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    """Revoke a session token."""
    data = request.get_json()
    token = data.get('token')
    
    if not token:
        return jsonify({'error': 'token is required'}), 400
    
    if revoke_session_token(token):
        return jsonify({'message': 'Session revoked successfully'}), 200
    else:
        return jsonify({'error': 'Token not found'}), 404

@app.route('/cleanup-sessions', methods=['POST'])
def cleanup():
    """Clean up expired sessions (admin endpoint)."""
    count = cleanup_expired_sessions()
    return jsonify({'cleaned_sessions': count}), 200

@app.route('/session-stats', methods=['GET'])
def session_stats():
    """Get statistics about active sessions."""
    current_time = time.time()
    active_sessions = 0
    expired_sessions = 0
    
    for session in sessions.values():
        if session['is_active'] and current_time <= session['expiry_timestamp']:
            active_sessions += 1
        else:
            expired_sessions += 1
    
    return jsonify({
        'active_sessions': active_sessions,
        'expired_sessions': expired_sessions,
        'total_sessions': len(sessions)
    }), 200

if __name__ == '__main__':
    # Example usage
    print("Session Token Generation System")
    print("=" * 50)
    
    # Generate a session token for a user
    user_session = generate_session_token('user_123', expiry_hours=24)
    print(f"Generated session token for user_123:")
    print(f"Token: {user_session['token']}")
    print(f"Expires at: {user_session['expires_at']}")
    print()
    
    # Validate the token
    token_to_validate = user_session['token']
    validation_result = validate_session_token(token_to_validate)
    if validation_result:
        print(f"Token is valid for user: {validation_result['user_id']}")
    print()
    
    # Generate another session for demonstration
    user_session_2 = generate_session_token('user_456', expiry_hours=12)
    print(f"Generated session token for user_456:")
    print(f"Token: {user_session_2['token']}")
    print()
    
    # Revoke a token
    if revoke_session_token(token_to_validate):
        print(f"Session token revoked successfully")
    print()
    
    # Try to validate the revoked token
    if not validate_session_token(token_to_validate):
        print(f"Revoked token is no longer valid")
    print()
    
    # Show session statistics
    print(f"Current sessions in store: {len(sessions)}")
    for token, session in sessions.items():
        print(f"  User: {session['user_id']}, Active: {session['is_active']}, "
              f"Expires: {datetime.fromtimestamp(session['expiry_timestamp']).isoformat()}")
    print()
    
    # Note: To run the Flask server, uncomment the line below
    # app.run(debug=True, port=5000)