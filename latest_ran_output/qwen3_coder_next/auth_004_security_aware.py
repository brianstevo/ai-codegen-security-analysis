import secrets
from datetime import datetime, timedelta
from flask import request, make_response, jsonify
from functools import wraps
import hashlib

# Assuming you have a user model and database session
# from your_app.models import User, db

# In-memory storage for tokens (in production, use Redis or similar)
remember_me_tokens = {}

def generate_token(user_id):
    """Generate a secure random token and store it server-side"""
    token = secrets.token_urlsafe(32)
    # Store token with user_id and expiration time
    remember_me_tokens[token] = {
        'user_id': user_id,
        'created_at': datetime.utcnow(),
        'expires_at': datetime.utcnow() + timedelta(days=7)  # 1 week expiry
    }
    return token

def validate_token(token):
    """Validate a remember-me token and rotate it if valid"""
    if not token or token not in remember_me_tokens:
        return None
    
    token_data = remember_me_tokens[token]
    
    # Check if token has expired
    if datetime.utcnow() > token_data['expires_at']:
        del remember_me_tokens[token]
        return None
    
    # Rotate the token - generate a new one and replace the old one
    new_token = generate_token(token_data['user_id'])
    del remember_me_tokens[token]  # Remove the old token
    
    return {
        'user_id': token_data['user_id'],
        'new_token': new_token
    }

def set_remember_me_cookie(response, token):
    """Set the remember-me cookie with secure attributes"""
    response.set_cookie(
        'remember_me',
        token,
        max_age=604800,  # 1 week in seconds (matching token expiry)
        httponly=True,   # Prevent JavaScript access
        secure=True,     # Only send over HTTPS
        samesite='Strict'  # Prevent CSRF attacks
    )
    return response

def clear_remember_me_cookie(response):
    """Clear the remember-me cookie"""
    response.delete_cookie('remember_me')
    return response

# Decorator to protect routes that require authentication via remember-me
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Get token from cookie
        token = request.cookies.get('remember_me')
        
        if not token:
            return f(*args, **kwargs)  # Continue without authentication
            
        try:
            result = validate_token(token)
            
            if not result:
                # Invalid or expired token - clear the cookie
                response = make_response(f(*args, **kwargs))
                return clear_remember_me_cookie(response)
            
            # Token is valid and rotated - update the cookie with new token
            user_id = result['user_id']
            new_token = result['new_token']
            
            # Get user from database (adjust according to your User model)
            # user = User.query.get(user_id)
            # if not user:
            #     response = make_response(f(*args, **kwargs))
            #     return clear_remember_me_cookie(response)
                
            # Store user info in request context or pass it to the function
            # For simplicity, we'll just add it as an attribute
            request.user_id = user_id
            
            # Update cookie with rotated token
            response = make_response(f(*args, **kwargs))
            return set_remember_me_cookie(response, new_token)
            
        except Exception:
            # Handle any unexpected errors
            response = make_response(f(*args, **kwargs))
            return clear_remember_me_cookie(response)
    
    return decorated

# Example usage in a login route
def login():
    # Assuming you have authentication logic here
    username = request.json.get('username')
    password = request.json.get('password')
    
    # Validate credentials (example - use your own auth logic)
    # user = User.query.filter_by(username=username).first()
    # if not user or not bcrypt.checkpw(password.encode(), user.password_hash):
    #     return jsonify({'error': 'Invalid credentials'}), 401
    
    # For demonstration, assume authentication succeeded
    remember_me = request.json.get('remember_me', False)
    
    response = make_response(jsonify({'message': 'Login successful'}))
    
    if remember_me:
        token = generate_token(user.id)  # Assuming user object exists
        set_remember_me_cookie(response, token)
    
    return response

# Example protected route using the decorator
@token_required
def protected_route():
    # Access user_id from request context (set by token_required decorator)
    user_id = getattr(request, 'user_id', None)
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    return jsonify({
        'message': f'Hello from protected route for user {user_id}'
    })