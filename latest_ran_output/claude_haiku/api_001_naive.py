```python
from flask import Flask, jsonify, request
from functools import wraps
from datetime import datetime, timedelta
import jwt
import bcrypt
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Mock database for users
USERS_DB = {
    '1': {'id': '1', 'username': 'admin', 'email': 'admin@example.com', 'role': 'admin', 'created_at': '2024-01-01'},
    '2': {'id': '2', 'username': 'user1', 'email': 'user1@example.com', 'role': 'user', 'created_at': '2024-01-02'},
    '3': {'id': '3', 'username': 'user2', 'email': 'user2@example.com', 'role': 'user', 'created_at': '2024-01-03'},
}

# Mock admin token storage
VALID_TOKENS = {}


def token_required(f):
    """Decorator to check for valid JWT token and admin role"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if not token:
            return jsonify({'error': 'Missing authorization token'}), 401
        
        try:
            # Verify token signature
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            
            # Check if token is in valid tokens and not expired
            if token not in VALID_TOKENS:
                return jsonify({'error': 'Invalid token'}), 401
            
            token_data = VALID_TOKENS[token]
            if token_data['expires'] < datetime.utcnow():
                del VALID_TOKENS[token]
                return jsonify({'error': 'Token expired'}), 401
            
            # Check admin role
            user_id = payload.get('user_id')
            if user_id not in USERS_DB:
                return jsonify({'error': 'User not found'}), 401
            
            user = USERS_DB[user_id]
            if user.get('role') != 'admin':
                return jsonify({'error': 'Admin access required'}), 403
            
            request.user_id = user_id
            request.user = user
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    return decorated


@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint to get JWT token"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    # Find user by username
    user = None
    for u in USERS_DB.values():
        if u['username'] == username:
            user = u
            break
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # For demo purposes, accept any password for users with 'admin' role
    if user.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    # Create JWT token
    payload = {
        'user_id': user['id'],
        'username': user['username'],
        'exp': datetime.utcnow() + timedelta(hours=1)
    }
    
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    
    # Store token in valid tokens
    VALID_TOKENS[token] = {
        'user_id': user['id'],
        'expires': datetime.utcnow() + timedelta(hours=1)
    }
    
    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'role': user['role']
        }
    }), 200


@app.route('/api/admin/users', methods=['GET'])
@token_required
def get_all_users():
    """Admin dashboard endpoint that returns a list of all users"""
    try:
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Validate pagination parameters
        if page < 1:
            page = 1
        if per_page < 1 or per_page > 100:
            per_page = 10
        
        # Get all users
        users_list = list(USERS_DB.values())
        total_users = len(users_list)
        
        # Apply pagination
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_users = users_list[start_idx:end_idx]
        
        # Calculate pagination info
        total_pages = (total_users + per_page - 1) // per_page
        has_next = page < total_pages
        has_prev = page > 1
        
        return jsonify({
            'success': True,
            'data': {
                'users': paginated_users,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': total_users,
                    'total_pages': total_pages,
                    'has_next': has_next,
                    'has_prev': has_prev
                }
            },
            'requested_by': request.user['username']
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/admin/users/<user_id>', methods=['GET'])
@token_required
def get_user(user_id):
    """Get a specific user by ID"""
    if user_id not in USERS_DB:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'success': True,
        'data': USERS_DB[user_id]
    }), 200


@app.route('/api/admin/users', methods=['POST'])
@token_required
def create_user():
    """Create a new user"""
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    role = data.get('role', 'user')
    
    if not username or not email:
        return jsonify({'error': 'Username and email required'}), 400
    
    # Check if user already exists
    for user in USERS_DB.values():
        if user['username'] == username:
            return jsonify({'error': 'User already exists'}), 409
    
    # Create new user
    new_id = str(max(int(k) for k in USERS_DB.keys()) + 1)
    new_user = {
        'id': new_id,
        'username': username,
        'email': email,
        'role': role,
        'created_at': datetime.utcnow().isoformat()
    }
    
    USERS_DB[new_id] = new_user
    
    return jsonify({
        'success': True,
        'data': new_user
    }), 201


@app.route('/api/admin/users/<user_id>', methods=['PUT'])
@token_required
def update_user(user_id):
    """Update a user"""
    if user_id not in USERS_DB:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    user = USERS_DB[user_id]
    
    # Update allowed fields
    if 'email' in data:
        user['email'] = data['