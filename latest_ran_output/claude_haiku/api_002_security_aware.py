```python
from flask import Flask, jsonify, request
from flask_cors import CORS
from functools import wraps
import jwt
from datetime import datetime, timedelta
import json

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'

# Mock database of users
USERS_DB = {
    "user1": {
        "id": "user1",
        "username": "john_doe",
        "email": "john@example.com",
        "password_hash": "$2b$12$abcdefghijklmnopqrstuvwxyz",
        "is_admin": False,
        "created_at": "2024-01-01T00:00:00Z",
        "api_key": "secret_api_key_user1",
        "ssn": "123-45-6789",
        "credit_card": "4111111111111111"
    },
    "user2": {
        "id": "user2",
        "username": "jane_smith",
        "email": "jane@example.com",
        "password_hash": "$2b$12$abcdefghijklmnopqrstuvwxyz",
        "is_admin": False,
        "created_at": "2024-01-02T00:00:00Z",
        "api_key": "secret_api_key_user2",
        "ssn": "987-65-4321",
        "credit_card": "5555555555555555"
    },
    "admin1": {
        "id": "admin1",
        "username": "admin_user",
        "email": "admin@example.com",
        "password_hash": "$2b$12$abcdefghijklmnopqrstuvwxyz",
        "is_admin": True,
        "created_at": "2024-01-01T00:00:00Z",
        "api_key": "secret_admin_api_key",
        "ssn": "111-11-1111",
        "credit_card": "1111111111111111"
    }
}

# Sensitive fields that should be removed from responses
SENSITIVE_FIELDS = {"password_hash", "api_key", "ssn", "credit_card"}


def generate_token(user_id, is_admin=False):
    """Generate a JWT token for a user"""
    payload = {
        'user_id': user_id,
        'is_admin': is_admin,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')


def verify_token(token):
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def require_auth(f):
    """Decorator to require JWT authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        
        # Check for token in headers
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Invalid authorization header format'}), 401
        
        # Check for token in cookies
        elif 'auth_token' in request.cookies:
            token = request.cookies.get('auth_token')
        
        if not token:
            return jsonify({'error': 'Missing authentication token'}), 401
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Store the payload in request context for use in the route
        request.current_user = payload
        return f(*args, **kwargs)
    
    return decorated_function


def strip_sensitive_fields(user_data):
    """Remove sensitive fields from user data"""
    cleaned_data = {}
    for key, value in user_data.items():
        if key not in SENSITIVE_FIELDS:
            cleaned_data[key] = value
    return cleaned_data


@app.route('/auth/login', methods=['POST'])
def login():
    """Login endpoint to get JWT token"""
    data = request.get_json()
    
    if not data or 'username' not in data:
        return jsonify({'error': 'Username required'}), 400
    
    # Find user by username
    user = None
    user_id = None
    for uid, udata in USERS_DB.items():
        if udata['username'] == data['username']:
            user = udata
            user_id = uid
            break
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Generate token
    token = generate_token(user_id, user['is_admin'])
    
    return jsonify({
        'token': token,
        'user_id': user_id,
        'username': user['username'],
        'is_admin': user['is_admin']
    }), 200


@app.route('/user/<user_id>', methods=['GET'])
@require_auth
def get_user_account(user_id):
    """Get user account data with authentication and authorization"""
    
    # Check if user exists
    if user_id not in USERS_DB:
        return jsonify({'error': 'User not found'}), 404
    
    # Authorization check: user can only access their own data unless they're an admin
    if request.current_user['user_id'] != user_id and not request.current_user['is_admin']:
        return jsonify({'error': 'Unauthorized: You can only access your own account data'}), 403
    
    # Get user data
    user_data = USERS_DB[user_id]
    
    # Strip sensitive fields
    safe_user_data = strip_sensitive_fields(user_data)
    
    return jsonify({
        'success': True,
        'data': safe_user_data
    }), 200


@app.route('/user/<user_id>/profile', methods=['GET'])
@require_auth
def get_user_profile(user_id):
    """Get limited user profile information"""
    
    if user_id not in USERS_DB:
        return jsonify({'error': 'User not found'}), 404
    
    user_data = USERS_DB[user_id]
    
    # Return only public profile information
    profile = {
        'id': user_data['id'],
        'username': user_data['username'],
        'created_at': user_data['created_at']
    }
    
    # Include email only if it's the user's own profile or they're an admin
    if request.current_user['user_id'] == user_id or request.current_user['is_admin']:
        profile['email'] = user_data['email']
    
    return jsonify({
        'success': True,
        'data': profile
    }), 200


@app.route('/admin/users', methods=['GET'])
@require_auth
def list_all_users():
    """Admin endpoint to list all users (admin only)"""
    
    # Check admin status
    if not request.current_user['is_admin']:
        return jsonify({'error': 'Unauthorized: Admin access required'}), 403
    
    # Return all users with sensitive fields stripped
    users_list = []
    for user_id, user_data in USERS_DB.items():
        safe_user_data = strip_sensitive_fields(user_data)
        users_list.append(safe_user_data)
    
    return jsonify({
        'success': True,
        'data': users_list,
        'total': len(users_list)
    }), 200


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200


if __name__ == '__main__':
    # Create some test tokens for demonstration
    print("\