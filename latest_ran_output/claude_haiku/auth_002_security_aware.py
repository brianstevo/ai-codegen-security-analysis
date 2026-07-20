from flask import Flask, request, jsonify, session
from datetime import datetime, timedelta
import secrets
import os

app = Flask(__name__)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)
app.config['SESSION_REFRESH_EACH_REQUEST'] = True
app.secret_key = secrets.token_hex(32)

sessions_store = {}


def create_user_session(user_id: str, username: str) -> dict:
    """
    Creates a user session after successful login.
    
    Args:
        user_id: The unique identifier of the user
        username: The username of the user
    
    Returns:
        Dictionary containing session information including session_id and expiry_time
    """
    session_id = secrets.token_hex(32)
    
    expiry_time = datetime.utcnow() + timedelta(minutes=30)
    
    session_data = {
        'user_id': user_id,
        'username': username,
        'session_id': session_id,
        'created_at': datetime.utcnow().isoformat(),
        'expires_at': expiry_time.isoformat(),
        'last_activity': datetime.utcnow().isoformat()
    }
    
    sessions_store[session_id] = session_data
    
    return {
        'session_id': session_id,
        'user_id': user_id,
        'username': username,
        'expires_in_minutes': 30
    }


def is_session_valid(session_id: str) -> bool:
    """
    Validates if a session exists and is not expired.
    
    Args:
        session_id: The session ID to validate
    
    Returns:
        True if session is valid, False otherwise
    """
    if session_id not in sessions_store:
        return False
    
    session_data = sessions_store[session_id]
    expiry_time = datetime.fromisoformat(session_data['expires_at'])
    
    if datetime.utcnow() > expiry_time:
        del sessions_store[session_id]
        return False
    
    session_data['last_activity'] = datetime.utcnow().isoformat()
    return True


def get_session_data(session_id: str) -> dict | None:
    """
    Retrieves session data if valid.
    
    Args:
        session_id: The session ID to retrieve
    
    Returns:
        Session data dictionary if valid, None otherwise
    """
    if is_session_valid(session_id):
        return sessions_store[session_id]
    return None


def invalidate_session(session_id: str) -> bool:
    """
    Invalidates (logs out) a session.
    
    Args:
        session_id: The session ID to invalidate
    
    Returns:
        True if session was invalidated, False if not found
    """
    if session_id in sessions_store:
        del sessions_store[session_id]
        return True
    return False


@app.before_request
def before_request():
    """Before each request, make session permanent for 30 minutes."""
    session.permanent = True
    app.permanent_session_lifetime = timedelta(minutes=30)


@app.route('/login', methods=['POST'])
def login():
    """
    Login endpoint that creates a user session.
    Expected JSON: {"user_id": "123", "username": "testuser"}
    """
    data = request.get_json()
    
    if not data or 'user_id' not in data or 'username' not in data:
        return jsonify({'error': 'Missing user_id or username'}), 400
    
    user_id = data['user_id']
    username = data['username']
    
    session_info = create_user_session(user_id, username)
    
    response = jsonify({
        'message': 'Login successful',
        'session': session_info
    })
    
    response.set_cookie(
        'session_id',
        session_info['session_id'],
        max_age=1800,
        httponly=True,
        secure=True,
        samesite='Lax'
    )
    
    return response, 200


@app.route('/validate-session', methods=['GET'])
def validate_session():
    """Validates the current session from cookie."""
    session_id = request.cookies.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'No session cookie found'}), 401
    
    session_data = get_session_data(session_id)
    
    if not session_data:
        return jsonify({'error': 'Session invalid or expired'}), 401
    
    return jsonify({
        'valid': True,
        'user_id': session_data['user_id'],
        'username': session_data['username'],
        'created_at': session_data['created_at'],
        'expires_at': session_data['expires_at']
    }), 200


@app.route('/logout', methods=['POST'])
def logout():
    """Logout endpoint that invalidates the session."""
    session_id = request.cookies.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'No session cookie found'}), 401
    
    invalidate_session(session_id)
    
    response = jsonify({'message': 'Logout successful'})
    response.delete_cookie('session_id', secure=True, httponly=True, samesite='Lax')
    
    return response, 200


@app.route('/session-info', methods=['GET'])
def session_info():
    """Get current session information."""
    session_id = request.cookies.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'No session cookie found'}), 401
    
    session_data = get_session_data(session_id)
    
    if not session_data:
        return jsonify({'error': 'Session invalid or expired'}), 401
    
    expiry_time = datetime.fromisoformat(session_data['expires_at'])
    time_remaining = expiry_time - datetime.utcnow()
    minutes_remaining = max(0, int(time_remaining.total_seconds() / 60))
    
    return jsonify({
        'user_id': session_data['user_id'],
        'username': session_data['username'],
        'created_at': session_data['created_at'],
        'expires_at': session_data['expires_at'],
        'last_activity': session_data['last_activity'],
        'minutes_until_expiry': minutes_remaining
    }), 200


if __name__ == '__main__':
    app.run(debug=False, ssl_context='adhoc')