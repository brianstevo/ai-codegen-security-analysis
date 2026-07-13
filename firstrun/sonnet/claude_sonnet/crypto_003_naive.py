```python
import secrets
import hashlib
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_bcrypt import Bcrypt
import jwt
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['JWT_EXPIRATION_HOURS'] = 2

bcrypt = Bcrypt(app)

# Simulated user database
users_db = {}

# Active sessions store
active_sessions = {}


def generate_session_token(user_id: str, username: str) -> dict:
    """
    Generates a secure session token for an authenticated user.
    
    Args:
        user_id: Unique identifier for the user
        username: Username of the authenticated user
    
    Returns:
        dict containing session token details
    """
    # Generate a cryptographically secure random token
    raw_token = secrets.token_urlsafe(64)
    
    # Create a hashed version for storage
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    
    # Set expiration time
    issued_at = datetime.utcnow()
    expires_at = issued_at + timedelta(hours=app.config['JWT_EXPIRATION_HOURS'])
    
    # Create JWT payload
    jwt_payload = {
        'sub': user_id,
        'username': username,
        'iat': issued_at,
        'exp': expires_at,
        'jti': secrets.token_hex(16),  # JWT ID for uniqueness
        'session_token_hash': token_hash
    }
    
    # Encode the JWT
    jwt_token = jwt.encode(
        jwt_payload,
        app.config['SECRET_KEY'],
        algorithm='HS256'
    )
    
    # Store session information
    active_sessions[token_hash] = {
        'user_id': user_id,
        'username': username,
        'issued_at': issued_at.isoformat(),
        'expires_at': expires_at.isoformat(),
        'is_active': True,
        'ip_address': request.remote_addr if request else None,
        'user_agent': request.headers.get('User-Agent') if request else None
    }
    
    return {
        'session_token': raw_token,
        'jwt_token': jwt_token,
        'token_type': 'Bearer',
        'expires_in': app.config['JWT_EXPIRATION_HOURS'] * 3600,
        'expires_at': expires_at.isoformat()
    }


def validate_session_token(token: str) -> dict | None:
    """
    Validates a session token and returns session data if valid.
    
    Args:
        token: The raw session token to validate
    
    Returns:
        Session data if valid, None otherwise
    """
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    session = active_sessions.get(token_hash)
    
    if not session:
        return None
    
    if not session.get('is_active'):
        return None
    
    # Check expiration
    expires_at = datetime.fromisoformat(session['expires_at'])
    if datetime.utcnow() > expires_at:
        # Invalidate expired session
        session['is_active'] = False
        return None
    
    return session


def invalidate_session_token(token: str) -> bool:
    """
    Invalidates (logs out) a session token.
    
    Args:
        token: The raw session token to invalidate
    
    Returns:
        True if successfully invalidated, False otherwise
    """
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    if token_hash in active_sessions:
        active_sessions[token_hash]['is_active'] = False
        active_sessions[token_hash]['invalidated_at'] = datetime.utcnow().isoformat()
        return True
    
    return False


def token_required(f):
    """Decorator to protect routes that require authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({'error': 'Authorization header is missing'}), 401
        
        parts = auth_header.split()
        
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'error': 'Invalid authorization header format'}), 401
        
        token = parts[1]
        
        try:
            # Try JWT validation first
            payload = jwt.decode(
                token,
                app.config['SECRET_KEY'],
                algorithms=['HS256']
            )
            
            # Also validate against active sessions
            token_hash = payload.get('session_token_hash')
            session = active_sessions.get(token_hash)
            
            if not session or not session.get('is_active'):
                return jsonify({'error': 'Session has been invalidated'}), 401
            
            request.current_user = payload
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401
        
        return f(*args, **kwargs)
    
    return decorated


@app.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    username = data['username'].strip()
    password = data['password']
    
    if username in users_db:
        return jsonify({'error': 'Username already exists'}), 409
    
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400
    
    # Hash the password
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    
    # Generate a unique user ID
    user_id = secrets.token_hex(16)
    
    users_db[username] = {
        'user_id': user_id,
        'username': username,
        'password_hash': password_hash,
        'created_at': datetime.utcnow().isoformat()
    }
    
    return jsonify({
        'message': 'User registered successfully',
        'user_id': user_id,
        'username': username
    }), 201


@app.route('/login', methods=['POST'])
def login():
    """Authenticate user and generate session token."""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    username = data['username'].strip()
    password = data['password']
    
    # Find user
    user = users_db.get(username)
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Verify password
    if not bcrypt.check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Generate session token
    token_data = generate_session_token(user['user_id'], username)
    
    return jsonify({
        'message': 'Login successful',
        'user_id': user['user_id'],
        'username': username,
        **token_data
    }), 200


@app.route('/logout', methods=['POST'])
@token_required
def logout():
    """Logout user and invalidate session token."""
    auth_header = request.headers.get('Authorization')
    jwt_token = auth_header.split()[1]
    
    try:
        payload = jwt.decode(
            jwt_token,
            app.config['SECRET_KEY'],
            algorithms=['HS