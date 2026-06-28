import os
import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, make_response
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')

# Mock database (in production, use a real database)
users_db = {}
remember_tokens_db = {}

def generate_remember_token(user_id):
    """Generate a secure random token for remember-me functionality"""
    token = secrets.token_urlsafe(32)
    # Store the token with expiration time (30 days from now)
    remember_tokens_db[token] = {
        'user_id': user_id,
        'created_at': datetime.utcnow(),
        'expires_at': datetime.utcnow() + timedelta(days=30)
    }
    return token

def validate_remember_token(token):
    """Validate a remember-me token and return the user ID if valid"""
    if not token or token not in remember_tokens_db:
        return None
    
    token_data = remember_tokens_db[token]
    
    # Check if token has expired
    if datetime.utcnow() > token_data['expires_at']:
        del remember_tokens_db[token]  # Clean up expired tokens
        return None
    
    return token_data['user_id']

def get_user_from_token(token):
    """Get user info from JWT access token"""
    try:
        payload = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        user_id = payload['sub']
        if user_id in users_db:
            return users_db[user_id]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        pass
    return None

def token_required(f):
    """Decorator to protect routes that require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for JWT in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Token is invalid'}), 401
        
        # If no JWT, check for remember-me cookie
        if not token and 'remember_token' in request.cookies:
            user_id = validate_remember_token(request.cookies.get('remember_token'))
            if user_id and user_id in users_db:
                return f(*args, **kwargs)
        
        if not token:
            return jsonify({'message': 'Authentication required'}), 401
            
        current_user = get_user_from_token(token)
        if not current_user:
            return jsonify({'message': 'Token is invalid or expired'}), 401
            
        return f(current_user, *args, **kwargs)
    
    return decorated

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    remember_me = data.get('remember_me', False)
    
    # Find user by email (mock implementation)
    user = None
    for u in users_db.values():
        if u['email'] == email:
            user = u
            break
    
    if not user or not check_password_hash(user['password'], password):
        return jsonify({'message': 'Invalid credentials'}), 401
    
    # Generate JWT access token (short-lived, e.g., 1 hour)
    payload = {
        'sub': user['id'],
        'exp': datetime.utcnow() + timedelta(hours=1),
        'iat': datetime.utcnow()
    }
    jwt_token = jwt.encode(payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')
    
    response = jsonify({
        'message': 'Login successful',
        'token': jwt_token,
        'user': {
            'id': user['id'],
            'email': user['email']
        }
    })
    
    # Set remember-me cookie if requested
    if remember_me:
        remember_token = generate_remember_token(user['id'])
        response.set_cookie(
            'remember_token',
            remember_token,
            max_age=30*24*60*60,  # 30 days in seconds
            httponly=True,         # Prevent JavaScript access to cookie
            secure=False,          # Set to True in production with HTTPS
            samesite='Lax'         # CSRF protection
        )
    
    return response

@app.route('/logout', methods=['POST'])
@token_required
def logout(current_user):
    # Remove remember-me token if present
    remember_token = request.cookies.get('remember_token')
    if remember_token and remember_token in remember_tokens_db:
        del remember_tokens_db[remember_token]
    
    response = jsonify({'message': 'Logged out successfully'})
    response.set_cookie('remember_token', '', expires=0)
    return response

@app.route('/refresh-token', methods=['POST'])
def refresh_token():
    """Refresh JWT token using remember-me cookie"""
    remember_token = request.cookies.get('remember_token')
    
    if not remember_token:
        return jsonify({'message': 'No remember token provided'}), 401
    
    user_id = validate_remember_token(remember_token)
    if not user_id or user_id not in users_db:
        response = jsonify({'message': 'Invalid remember token'})
        response.set_cookie('remember_token', '', expires=0)
        return response
    
    # Generate new JWT access token
    payload = {
        'sub': user_id,
        'exp': datetime.utcnow() + timedelta(hours=1),
        'iat': datetime.utcnow()
    }
    jwt_token = jwt.encode(payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'message': 'Token refreshed',
        'token': jwt_token
    })

# Example protected route
@app.route('/profile', methods=['GET'])
@token_required
def profile(current_user):
    return jsonify({
        'id': current_user['id'],
        'email': current_user['email']
    })