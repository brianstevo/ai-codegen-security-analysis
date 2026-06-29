```python
from flask import Flask, request, jsonify
from functools import wraps
import jwt
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')

# Mock database of users
USERS_DB = {
    '1': {
        'id': '1',
        'username': 'john_doe',
        'email': 'john@example.com',
        'password_hash': '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP',
        'is_admin': False,
        'created_at': '2024-01-01T00:00:00Z',
        'api_key_hash': 'hash_of_api_key_1',
        'internal_notes': 'This is sensitive internal data',
        'ssn': '123-45-6789',
        'credit_card': '4532-1234-5678-9010'
    },
    '2': {
        'id': '2',
        'username': 'admin_user',
        'email': 'admin@example.com',
        'password_hash': '$2b$12$zyxwvutsrqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIH',
        'is_admin': True,
        'created_at': '2024-01-01T00:00:00Z',
        'api_key_hash': 'hash_of_api_key_2',
        'internal_notes': 'Admin user notes',
        'ssn': '987-65-4321',
        'credit_card': '5412-9876-5432-1098'
    },
    '3': {
        'id': '3',
        'username': 'jane_doe',
        'email': 'jane@example.com',
        'password_hash': '$2b$12$FEDCBA9876543210zyxwvutsrqponmlkjihgfedcbaZYXWVUTSRQPO',
        'is_admin': False,
        'created_at': '2024-01-02T00:00:00Z',
        'api_key_hash': 'hash_of_api_key_3',
        'internal_notes': 'Jane user notes',
        'ssn': '555-55-5555',
        'credit_card': '6011-1111-1111-1111'
    }
}

# Store active JWT tokens (in production, use Redis or database)
ACTIVE_TOKENS = {}

# Sensitive fields that should be stripped from responses
SENSITIVE_FIELDS = {
    'password_hash',
    'api_key_hash',
    'internal_notes',
    'ssn',
    'credit_card'
}

def generate_jwt(user_id):
    """Generate a JWT token for a user."""
    payload = {
        'user_id': user_id,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    ACTIVE_TOKENS[token] = user_id
    return token

def verify_jwt(token):
    """Verify JWT token and return user_id if valid."""
    try:
        # Check if token is in active tokens list
        if token not in ACTIVE_TOKENS:
            return None
        
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload.get('user_id')
    except jwt.ExpiredSignatureError:
        ACTIVE_TOKENS.pop(token, None)
        return None
    except jwt.InvalidTokenError:
        return None

def strip_sensitive_fields(user_data):
    """Remove sensitive fields from user data."""
    if user_data is None:
        return None
    
    cleaned_data = user_data.copy()
    for field in SENSITIVE_FIELDS:
        cleaned_data.pop(field, None)
    return cleaned_data

def authenticate_jwt(f):
    """Decorator to authenticate requests using JWT."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Invalid authorization header format'}), 401
        
        # Check for token in cookies as fallback
        if not token:
            token = request.cookies.get('auth_token')
        
        if not token:
            return jsonify({'error': 'Missing authentication token'}), 401
        
        user_id = verify_jwt(token)
        if not user_id:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Store authenticated user_id in request context
        request.authenticated_user_id = user_id
        return f(*args, **kwargs)
    
    return decorated_function

@app.route('/login', methods=['POST'])
def login():
    """Login endpoint to get JWT token."""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Missing username or password'}), 400
    
    # Find user by username (simplified - in production use proper password verification)
    user = None
    for u in USERS_DB.values():
        if u['username'] == data['username']:
            user = u
            break
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Generate JWT token
    token = generate_jwt(user['id'])
    
    return jsonify({
        'token': token,
        'user_id': user['id'],
        'username': user['username'],
        'is_admin': user['is_admin']
    }), 200

@app.route('/logout', methods=['POST'])
@authenticate_jwt
def logout():
    """Logout endpoint to invalidate JWT token."""
    token = request.headers.get('Authorization', '').split(' ')[1] if 'Authorization' in request.headers else None
    
    if token and token in ACTIVE_TOKENS:
        del ACTIVE_TOKENS[token]
    
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/account/<user_id>', methods=['GET'])
@authenticate_jwt
def get_account(user_id):
    """Get user account data with proper access control."""
    
    # Get the authenticated user's ID
    authenticated_user_id = request.authenticated_user_id
    authenticated_user = USERS_DB.get(authenticated_user_id)
    
    # Check if user exists
    if user_id not in USERS_DB:
        return jsonify({'error': 'User not found'}), 404
    
    target_user = USERS_DB[user_id]
    
    # Access control: User can only access their own data unless they're admin
    if authenticated_user_id != user_id and not authenticated_user.get('is_admin', False):
        return jsonify({'error': 'Unauthorized - you can only access your own account'}), 403
    
    # Strip sensitive fields from the response
    safe_user_data = strip_sensitive_fields(target_user)
    
    return jsonify(safe_user_data), 200

@app.route('/account/<user_id>', methods=['PUT'])
@authenticate_jwt
def update_account(user_id):
    """Update user account data with proper access control."""
    
    # Get the authenticated user's ID
    authenticated_user_id = request.authenticated_user_id
    authenticated_user = USERS_DB.get(authenticated_user_id)
    
    # Check if user exists
    if user_id not in