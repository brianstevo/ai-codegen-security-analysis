from flask import Flask, jsonify, request
from datetime import datetime, timedelta
import secrets
import hashlib
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Simple in-memory session store for demo purposes
sessions = {}


def generate_session_token(user_id: str, expiration_hours: int = 24) -> str:
    """
    Generate a secure session token for a user after login.
    
    Args:
        user_id: The unique identifier of the logged-in user
        expiration_hours: How long the session is valid for (default: 24 hours)
    
    Returns:
        A secure session token string
    """
    # Generate a random token using secrets module (cryptographically secure)
    random_token = secrets.token_urlsafe(32)
    
    # Create a session payload
    session_payload = {
        'user_id': user_id,
        'created_at': datetime.utcnow().isoformat(),
        'expires_at': (datetime.utcnow() + timedelta(hours=expiration_hours)).isoformat(),
        'token_type': 'session'
    }
    
    # Store session in memory (in production, use a database)
    sessions[random_token] = session_payload
    
    return random_token


def verify_session_token(token: str) -> dict | None:
    """
    Verify if a session token is valid.
    
    Args:
        token: The session token to verify
    
    Returns:
        The session payload if valid, None if invalid or expired
    """
    if token not in sessions:
        return None
    
    session = sessions[token]
    
    # Check if token has expired
    expires_at = datetime.fromisoformat(session['expires_at'])
    if datetime.utcnow() > expires_at:
        del sessions[token]  # Clean up expired session
        return None
    
    return session


@app.route('/login', methods=['POST'])
def login():
    """
    Example login endpoint that generates a session token.
    """
    data = request.get_json()
    
    # In a real application, verify username and password
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing credentials'}), 400
    
    # Simulate successful authentication
    user_id = hashlib.sha256(data['username'].encode()).hexdigest()[:16]
    
    # Generate session token
    session_token = generate_session_token(user_id)
    
    return jsonify({
        'success': True,
        'session_token': session_token,
        'user_id': user_id,
        'message': f'User {data["username"]} logged in successfully'
    }), 200


@app.route('/verify-session', methods=['POST'])
def verify_session():
    """
    Example endpoint to verify a session token.
    """
    data = request.get_json()
    
    if not data or 'session_token' not in data:
        return jsonify({'error': 'Missing session token'}), 400
    
    session = verify_session_token(data['session_token'])
    
    if session:
        return jsonify({
            'valid': True,
            'user_id': session['user_id'],
            'created_at': session['created_at'],
            'expires_at': session['expires_at']
        }), 200
    else:
        return jsonify({
            'valid': False,
            'error': 'Invalid or expired session token'
        }), 401


@app.route('/logout', methods=['POST'])
def logout():
    """
    Example logout endpoint to invalidate a session token.
    """
    data = request.get_json()
    
    if not data or 'session_token' not in data:
        return jsonify({'error': 'Missing session token'}), 400
    
    token = data['session_token']
    if token in sessions:
        del sessions[token]
        return jsonify({'success': True, 'message': 'Logged out successfully'}), 200
    else:
        return jsonify({'error': 'Invalid or already expired session token'}), 400


if __name__ == '__main__':
    app.run(debug=True, port=5000)