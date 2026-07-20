from flask import Flask, request, jsonify
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# In-memory token storage (in production, use a database)
active_sessions = {}

def generate_session_token(user_id: str, expires_in_hours: int = 24) -> dict:
    """
    Generate a secure session token for a user.
    
    Args:
        user_id: The ID of the user logging in
        expires_in_hours: Token expiration time in hours (default: 24)
    
    Returns:
        A dictionary containing the token and expiration time
    """
    # Generate a cryptographically secure random token
    token = secrets.token_urlsafe(32)
    
    # Create token hash for secure storage
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Calculate expiration time
    now = datetime.now(timezone.utc)
    expiration = now + timedelta(hours=expires_in_hours)
    
    # Store session data
    active_sessions[token_hash] = {
        'user_id': user_id,
        'created_at': now.isoformat(),
        'expires_at': expiration.isoformat(),
        'is_active': True
    }
    
    return {
        'token': token,
        'expires_at': expiration.isoformat(),
        'expires_in_hours': expires_in_hours,
        'token_type': 'Bearer'
    }

def verify_session_token(token: str) -> dict | None:
    """
    Verify a session token and return session data if valid.
    
    Args:
        token: The session token to verify
    
    Returns:
        Session data if valid, None if invalid or expired
    """
    # Hash the provided token
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Check if token exists
    if token_hash not in active_sessions:
        return None
    
    session = active_sessions[token_hash]
    
    # Check if token has expired
    expiration = datetime.fromisoformat(session['expires_at'])
    if datetime.now(timezone.utc) > expiration:
        # Clean up expired token
        del active_sessions[token_hash]
        return None
    
    # Check if session is still active
    if not session['is_active']:
        return None
    
    return session

def revoke_session_token(token: str) -> bool:
    """
    Revoke a session token.
    
    Args:
        token: The session token to revoke
    
    Returns:
        True if revoked successfully, False if token not found
    """
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    if token_hash in active_sessions:
        active_sessions[token_hash]['is_active'] = False
        return True
    
    return False

@app.route('/login', methods=['POST'])
def login():
    """
    Login endpoint that generates a session token.
    """
    try:
        data = request.get_json()
        
        if not data or 'user_id' not in data:
            return jsonify({'error': 'user_id is required'}), 400
        
        user_id = data.get('user_id')
        expires_in_hours = data.get('expires_in_hours', 24)
        
        # Generate session token
        session_data = generate_session_token(user_id, expires_in_hours)
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'data': session_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/verify', methods=['POST'])
def verify():
    """
    Endpoint to verify a session token.
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Invalid authorization header'}), 401
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        # Verify token
        session = verify_session_token(token)
        
        if not session:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        return jsonify({
            'success': True,
            'message': 'Token is valid',
            'session': session
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/logout', methods=['POST'])
def logout():
    """
    Endpoint to logout and revoke the session token.
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Invalid authorization header'}), 401
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        # Revoke token
        if revoke_session_token(token):
            return jsonify({
                'success': True,
                'message': 'Logout successful'
            }), 200
        else:
            return jsonify({'error': 'Token not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Example usage demonstrating the functions
    print("Session Token Generator Example\n" + "="*40)
    
    # Generate a token for a user
    print("\n1. Generating session token for user_123...")
    token_data = generate_session_token('user_123', expires_in_hours=24)
    print(f"   Token: {token_data['token'][:20]}...")
    print(f"   Expires at: {token_data['expires_at']}")
    
    # Verify the token
    print("\n2. Verifying the token...")
    session = verify_session_token(token_data['token'])
    if session:
        print(f"   Token is valid!")
        print(f"   User ID: {session['user_id']}")
        print(f"   Created at: {session['created_at']}")
    
    # Test with invalid token
    print("\n3. Verifying an invalid token...")
    invalid_session = verify_session_token('invalid_token_xyz')
    print(f"   Invalid token result: {invalid_session}")
    
    # Revoke the token
    print("\n4. Revoking the token...")
    revoked = revoke_session_token(token_data['token'])
    print(f"   Revocation successful: {revoked}")
    
    # Try to verify the revoked token
    print("\n5. Verifying the revoked token...")
    revoked_session = verify_session_token(token_data['token'])
    print(f"   Revoked token result: {revoked_session}")
    
    print("\n" + "="*40)
    print("Running Flask server on http://localhost:5000")
    app.run(debug=True, port=5000)