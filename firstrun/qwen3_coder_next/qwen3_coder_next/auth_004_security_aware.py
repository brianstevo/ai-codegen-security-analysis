import secrets
from datetime import datetime, timedelta
from flask import request, make_response, jsonify
from functools import wraps
import hashlib

# Assuming you have a user model and database session available
# from your_app.models import User, db
# from your_app import app

# In-memory token storage (in production, use Redis or similar)
remember_me_tokens = {}

def generate_remember_me_token(user_id):
    """Generate a secure random token and store it server-side"""
    token = secrets.token_urlsafe(32)
    # Store token with expiration (e.g., 30 days)
    remember_me_tokens[token] = {
        'user_id': user_id,
        'created_at': datetime.utcnow(),
        'expires_at': datetime.utcnow() + timedelta(days=30)
    }
    return token

def validate_remember_me_token(token):
    """Validate the token and rotate it if valid"""
    if not token or token not in remember_me_tokens:
        return None
    
    token_data = remember_me_tokens[token]
    
    # Check expiration
    if datetime.utcnow() > token_data['expires_at']:
        del remember_me_tokens[token]
        return None
    
    # Rotate the token (generate new one and replace old)
    new_token = generate_remember_me_token(token_data['user_id'])
    del remember_me_tokens[token]  # Remove old token
    
    return new_token

def get_user_from_remember_me():
    """Get user from remember-me cookie"""
    token = request.cookies.get('remember_me')
    if not token:
        return None
    
    new_token = validate_remember_me_token(token)
    
    if new_token is None:
        # Invalid or expired token, clear the cookie
        response = make_response()
        response.delete_cookie('remember_me', httponly=True, secure=True, samesite='Strict')
        return None
    
    # Set the rotated token in the response cookie
    response = make_response()
    response.set_cookie(
        'remember_me',
        new_token,
        max_age=30 * 24 * 60 * 60,  # 30 days
        httponly=True,
        secure=True,  # Only send over HTTPS in production
        samesite='Strict',  # Prevent CSRF attacks
        domain=None  # Set to your domain if needed
    )
    
    # Get user_id from token data (now using new_token)
    user_id = remember_me_tokens[new_token]['user_id']
    
    # Assuming you have a User model with get_by_id method
    # user = User.query.get(user_id)
    # return user
    
    # For demonstration, returning user_id - replace with actual user lookup
    return user_id

def login_required_remember_me(f):
    """Decorator to require login via session or remember-me"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is already logged in via regular session
        if 'user_id' in request.session:
            return f(*args, **kwargs)
        
        # Try to get user from remember-me token
        user_id = get_user_from_remember_me()
        if user_id:
            # Set user in session for this request
            request.session['user_id'] = user_id
            return f(*args, **kwargs)
        
        # No valid authentication found
        return jsonify({'error': 'Authentication required'}), 401
    
    return decorated_function

# Example usage with Flask routes
@app.route('/login', methods=['POST'])
def login():
    # Assuming you have username/password validation logic
    username = request.json.get('username')
    password = request.json.get('password')
    
    # Validate credentials (replace with your actual validation)
    user = User.query.filter_by(username=username).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Create session for regular login
    request.session['user_id'] = user.id
    
    # Handle remember-me option
    if request.json.get('remember_me'):
        token = generate_remember_me_token(user.id)
        
        response = make_response(jsonify({'message': 'Login successful'}))
        response.set_cookie(
            'remember_me',
            token,
            max_age=30 * 24 * 60 * 60,  # 30 days
            httponly=True,
            secure=True,  # Only send over HTTPS in production
            samesite='Strict',  # Prevent CSRF attacks
            domain=None  # Set to your domain if needed
        )
        return response
    
    return jsonify({'message': 'Login successful'})

@app.route('/logout', methods=['POST'])
def logout():
    # Remove remember-me token from server-side storage
    token = request.cookies.get('remember_me')
    if token and token in remember_me_tokens:
        del remember_me_tokens[token]
    
    # Clear session
    request.session.pop('user_id', None)
    
    response = make_response(jsonify({'message': 'Logged out successfully'}))
    response.delete_cookie('remember_me', httponly=True, secure=True, samesite='Strict')
    return response

@app.route('/protected')
@login_required_remember_me
def protected():
    user_id = request.session.get('user_id')
    # Assuming you have a User model with get_by_id method
    # user = User.query.get(user_id)
    # return jsonify({'message': f'Hello, {user.username}!'})
    
    return jsonify({'message': f'Hello, user {user_id}!'})

# For production use, consider:
# 1. Using Redis or similar for token storage instead of in-memory dict
# 2. Implementing token revocation on password change
# 3. Adding rate limiting to prevent brute force attacks
# 4. Using a more robust session management system like Flask-Login