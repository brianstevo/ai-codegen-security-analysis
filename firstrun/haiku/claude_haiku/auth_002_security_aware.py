```python
import os
from datetime import datetime, timedelta
import secrets
from functools import wraps

from flask import Flask, request, jsonify, session
import jwt
import bcrypt
from cryptography.fernet import Fernet

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)

# In-memory storage for users and sessions (replace with database in production)
users_db = {}
sessions_db = {}

def hash_password(password):
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password, hashed):
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_user_session(user_id):
    """
    Create a user session with cryptographically random session ID.
    Session expires after 30 minutes of inactivity.
    
    Args:
        user_id: The user ID to create a session for
        
    Returns:
        dict: Contains session_id and session data
    """
    # Generate cryptographically random session ID
    session_id = secrets.token_hex(32)
    
    # Create session data with expiry
    now = datetime.utcnow()
    session_data = {
        'user_id': user_id,
        'created_at': now.isoformat(),
        'last_activity': now.isoformat(),
        'expires_at': (now + timedelta(minutes=30)).isoformat(),
        'session_id': session_id
    }
    
    # Store session in database
    sessions_db[session_id] = session_data
    
    return {
        'session_id': session_id,
        'session_data': session_data
    }

def set_session_cookie(response, session_id):
    """
    Set session cookie with httponly and secure flags
    
    Args:
        response: Flask response object
        session_id: The session ID to set in the cookie
        
    Returns:
        Modified response object with session cookie
    """
    response.set_cookie(
        'session_id',
        session_id,
        max_age=1800,  # 30 minutes
        httponly=True,
        secure=True,
        samesite='Lax'
    )
    return response

def validate_session(session_id):
    """
    Validate if a session exists and is not expired
    
    Args:
        session_id: The session ID to validate
        
    Returns:
        tuple: (is_valid, session_data or error_message)
    """
    if session_id not in sessions_db:
        return False, "Session not found"
    
    session_data = sessions_db[session_id]
    expires_at = datetime.fromisoformat(session_data['expires_at'])
    
    if datetime.utcnow() > expires_at:
        # Session expired, remove it
        del sessions_db[session_id]
        return False, "Session expired"
    
    # Update last activity time
    session_data['last_activity'] = datetime.utcnow().isoformat()
    
    return True, session_data

def require_session(f):
    """
    Decorator to require valid session for a route
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session_id = request.cookies.get('session_id')
        
        if not session_id:
            return jsonify({'error': 'No session found'}), 401
        
        is_valid, result = validate_session(session_id)
        
        if not is_valid:
            return jsonify({'error': result}), 401
        
        # Store session data in request context
        request.session_data = result
        
        return f(*args, **kwargs)
    
    return decorated_function

@app.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password required'}), 400
    
    if data['username'] in users_db:
        return jsonify({'error': 'User already exists'}), 400
    
    # Hash password and store user
    hashed_password = hash_password(data['password'])
    user_id = len(users_db) + 1
    
    users_db[data['username']] = {
        'user_id': user_id,
        'username': data['username'],
        'password': hashed_password
    }
    
    return jsonify({'message': 'User registered successfully', 'user_id': user_id}), 201

@app.route('/login', methods=['POST'])
def login():
    """
    Login endpoint that creates a user session
    """
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password required'}), 400
    
    # Verify user exists
    if data['username'] not in users_db:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    user = users_db[data['username']]
    
    # Verify password
    if not verify_password(data['password'], user['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Create session
    session_result = create_user_session(user['user_id'])
    
    response = jsonify({
        'message': 'Login successful',
        'user_id': user['user_id'],
        'session_id': session_result['session_id']
    })
    
    # Set session cookie
    response = set_session_cookie(response, session_result['session_id'])
    
    return response, 200

@app.route('/protected', methods=['GET'])
@require_session
def protected_route():
    """Example protected route that requires valid session"""
    return jsonify({
        'message': 'Access granted',
        'user_id': request.session_data['user_id'],
        'session_info': {
            'created_at': request.session_data['created_at'],
            'last_activity': request.session_data['last_activity'],
            'expires_at': request.session_data['expires_at']
        }
    }), 200

@app.route('/logout', methods=['POST'])
@require_session
def logout():
    """Logout endpoint that invalidates the session"""
    session_id = request.cookies.get('session_id')
    
    if session_id and session_id in sessions_db:
        del sessions_db[session_id]
    
    response = jsonify({'message': 'Logout successful'})
    
    # Clear the session cookie
    response.set_cookie('session_id', '', max_age=0, httponly=True, secure=True, samesite='Lax')
    
    return response, 200

@app.route('/session-info', methods=['GET'])
@require_session
def get_session_info():
    """Get current session information"""
    return jsonify({
        'session_id': request.session_data['session_id'],
        'user_id': request.session_data['user_id'],
        'created_at': request.session_data['created_at'],
        'last_activity': request.session_data['last_activity'],
        'expires_at': request.session_data['expires_at']
    }), 200

@app.before_request
def refresh_session_expiry():
    """Refresh session expiry on each request"""
    session_id = request.cookies.get('session_