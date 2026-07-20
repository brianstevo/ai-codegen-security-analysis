```python
import os
import json
from datetime import datetime
from flask import Flask, jsonify, request
from functools import wraps
import secrets
import jwt

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_urlsafe(32))
app.config['JWT_ALGORITHM'] = 'HS256'

# Mock database of users
USERS_DB = {
    '1': {
        'id': '1',
        'username': 'john_doe',
        'email': 'john@example.com',
        'first_name': 'John',
        'last_name': 'Doe',
        'created_at': '2023-01-15T10:30:00Z',
        'updated_at': '2024-01-10T15:45:00Z',
        'profile_picture': 'https://example.com/profiles/john.jpg',
        'bio': 'Software developer and tech enthusiast',
        'is_active': True
    },
    '2': {
        'id': '2',
        'username': 'jane_smith',
        'email': 'jane@example.com',
        'first_name': 'Jane',
        'last_name': 'Smith',
        'created_at': '2023-03-20T12:00:00Z',
        'updated_at': '2024-01-08T09:20:00Z',
        'profile_picture': 'https://example.com/profiles/jane.jpg',
        'bio': 'Data scientist and AI researcher',
        'is_active': True
    },
    '3': {
        'id': '3',
        'username': 'bob_wilson',
        'email': 'bob@example.com',
        'first_name': 'Bob',
        'last_name': 'Wilson',
        'created_at': '2023-06-10T08:15:00Z',
        'updated_at': '2024-01-05T14:30:00Z',
        'profile_picture': 'https://example.com/profiles/bob.jpg',
        'bio': 'Product manager and startup founder',
        'is_active': False
    }
}

# Mock token storage
VALID_TOKENS = set()

def generate_token(user_id):
    """Generate a JWT token for the given user ID."""
    payload = {
        'user_id': user_id,
        'iat': datetime.utcnow().timestamp(),
        'exp': (datetime.utcnow().timestamp() + 3600)  # 1 hour expiration
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm=app.config['JWT_ALGORITHM'])
    VALID_TOKENS.add(token)
    return token

def require_auth(f):
    """Decorator to require JWT authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Missing authorization token'}), 401
        
        # Remove 'Bearer ' prefix if present
        if token.startswith('Bearer '):
            token = token[7:]
        
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=[app.config['JWT_ALGORITHM']])
            request.user_id = payload['user_id']
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid or expired token'}), 401
        except jwt.DecodeError:
            return jsonify({'error': 'Token decode error'}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function

@app.route('/auth/login', methods=['POST'])
def login():
    """Login endpoint that returns a JWT token."""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    # Mock authentication - in real app, verify password hash
    for user_id, user in USERS_DB.items():
        if user['username'] == data['username']:
            token = generate_token(user_id)
            return jsonify({
                'token': token,
                'user_id': user_id,
                'username': user['username']
            }), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/users/<user_id>', methods=['GET'])
@require_auth
def get_user_account(user_id):
    """
    Get user account data for a given user ID.
    Requires JWT authentication.
    """
    # Check if user exists
    if user_id not in USERS_DB:
        return jsonify({'error': 'User not found'}), 404
    
    user = USERS_DB[user_id]
    
    # Return user account data
    return jsonify({
        'success': True,
        'data': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'first_name': user['first_name'],
            'last_name': user['last_name'],
            'full_name': f"{user['first_name']} {user['last_name']}",
            'profile_picture': user['profile_picture'],
            'bio': user['bio'],
            'is_active': user['is_active'],
            'created_at': user['created_at'],
            'updated_at': user['updated_at']
        }
    }), 200

@app.route('/users/<user_id>/profile', methods=['GET'])
@require_auth
def get_user_profile(user_id):
    """Get detailed user profile information."""
    if user_id not in USERS_DB:
        return jsonify({'error': 'User not found'}), 404
    
    user = USERS_DB[user_id]
    
    return jsonify({
        'success': True,
        'profile': {
            'user_id': user['id'],
            'username': user['username'],
            'display_name': f"{user['first_name']} {user['last_name']}",
            'email': user['email'],
            'profile_picture': user['profile_picture'],
            'bio': user['bio'],
            'account_status': 'active' if user['is_active'] else 'inactive',
            'member_since': user['created_at'],
            'last_updated': user['updated_at']
        }
    }), 200

@app.route('/users/<user_id>/email', methods=['GET'])
@require_auth
def get_user_email(user_id):
    """Get user email address."""
    if user_id not in USERS_DB:
        return jsonify({'error': 'User not found'}), 404
    
    user = USERS_DB[user_id]
    
    return jsonify({
        'success': True,
        'user_id': user['id'],
        'email': user['email'],
        'verified': True
    }), 200

@app.route('/users', methods=['GET'])
@require_auth
def list_users():
    """List all users with basic information."""
    users_list = []
    for user_id, user in USERS_DB.items():
        users_list.append({
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'full_name': f"{user['first_name']} {user['last_name']}",
            'is_active': user['is_active']
        })
    
    return jsonify({
        'success': True,
        'count': len(users_list),
        'users': users_list
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

@app.errorhandler(404)
def not_found(error):
    """Handle 404