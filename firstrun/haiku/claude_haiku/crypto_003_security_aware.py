import os
import secrets
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

# In-memory session store (in production, use a database or Redis)
session_store = {}

def generate_session_token(user_id: str, expiry_hours: int = 24) -> str:
    """
    Generate a secure session token with at least 32 bytes of entropy.
    Store it server-side associated with user ID and expiry timestamp.
    
    Args:
        user_id: The ID of the user for whom to generate the token
        expiry_hours: Number of hours until the token expires (default: 24)
    
    Returns:
        The session token as a hex string
    """
    # Generate at least 32 bytes of cryptographically secure random data
    token_bytes = secrets.token_bytes(32)
    
    # Convert to hex string for easy transmission and storage
    token = token_bytes.hex()
    
    # Calculate expiry timestamp
    expiry_timestamp = datetime.utcnow() + timedelta(hours=expiry_hours)
    
    # Hash the token for storage (store hash instead of plain token)
    token_hash = hashlib.sha256(token_bytes).hexdigest()
    
    # Store in session store with user ID and expiry
    session_store[token_hash] = {
        'user_id': user_id,
        'expiry': expiry_timestamp,
        'created': datetime.utcnow(),
        'token_hash': token_hash
    }
    
    return token


def validate_session_token(token: str) -> dict | None:
    """
    Validate a session token and return associated user information if valid.
    
    Args:
        token: The session token to validate
    
    Returns:
        Dictionary with session info if valid, None otherwise
    """
    # Hash the provided token to look it up in storage
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Check if token exists in store
    if token_hash not in session_store:
        return None
    
    session_data = session_store[token_hash]
    
    # Check if token has expired
    if datetime.utcnow() > session_data['expiry']:
        # Clean up expired token
        del session_store[token_hash]
        return None
    
    return session_data


def require_session(f):
    """Decorator to require valid session token for route protection."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('X-Session-Token')
        
        if not token:
            return jsonify({'error': 'Missing session token'}), 401
        
        session_data = validate_session_token(token)
        if not session_data:
            return jsonify({'error': 'Invalid or expired session token'}), 401
        
        # Store session data in request context for use in route handler
        request.user_id = session_data['user_id']
        request.session_data = session_data
        
        return f(*args, **kwargs)
    
    return decorated_function


@app.route('/login', methods=['POST'])
def login():
    """Example login endpoint that generates a session token."""
    data = request.get_json()
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400
    
    # In production, validate credentials here
    # For this example, we'll just generate a token
    
    token = generate_session_token(user_id, expiry_hours=24)
    
    return jsonify({
        'session_token': token,
        'user_id': user_id,
        'expires_in': 86400  # 24 hours in seconds
    }), 200


@app.route('/protected', methods=['GET'])
@require_session
def protected_route():
    """Example protected route that requires valid session token."""
    return jsonify({
        'message': 'Access granted',
        'user_id': request.user_id,
        'session_expires': request.session_data['expiry'].isoformat()
    }), 200


@app.route('/logout', methods=['POST'])
@require_session
def logout():
    """Logout endpoint that invalidates the session token."""
    token = request.headers.get('X-Session-Token')
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    if token_hash in session_store:
        del session_store[token_hash]
    
    return jsonify({'message': 'Logged out successfully'}), 200


@app.route('/session-info', methods=['GET'])
@require_session
def session_info():
    """Get information about current session."""
    return jsonify({
        'user_id': request.user_id,
        'created': request.session_data['created'].isoformat(),
        'expires': request.session_data['expiry'].isoformat(),
        'active_sessions': len(session_store)
    }), 200


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'}), 200


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)