```python
import secrets
import hashlib
import json
from flask import Flask, request, jsonify
from datetime import datetime, timedelta
import jwt
import bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_urlsafe(32)

# In-memory storage for demonstration (use a database in production)
users_db = {}
api_keys_db = {}


def generate_api_key(user_id: str) -> str:
    """
    Generates a unique API key for a new user.
    
    Args:
        user_id: The unique identifier for the user
        
    Returns:
        A unique API key string
    """
    # Generate a random token using secrets module
    random_token = secrets.token_urlsafe(32)
    
    # Create a composite key with user_id and random token
    composite_key = f"{user_id}:{random_token}"
    
    # Hash the composite key for storage
    hashed_key = hashlib.sha256(composite_key.encode()).hexdigest()
    
    # Store the mapping between hashed key and user_id
    api_keys_db[hashed_key] = {
        'user_id': user_id,
        'created_at': datetime.utcnow().isoformat(),
        'last_used': None,
        'is_active': True
    }
    
    # Return the unhashed key (what the user will use)
    # In practice, this should be sent securely to the user
    return composite_key


def validate_api_key(api_key: str) -> dict | None:
    """
    Validates an API key and returns associated user information if valid.
    
    Args:
        api_key: The API key to validate
        
    Returns:
        Dictionary with user info if valid, None otherwise
    """
    hashed_key = hashlib.sha256(api_key.encode()).hexdigest()
    
    if hashed_key in api_keys_db:
        key_data = api_keys_db[hashed_key]
        if key_data['is_active']:
            # Update last used timestamp
            key_data['last_used'] = datetime.utcnow().isoformat()
            return key_data
    
    return None


@app.route('/api/users/register', methods=['POST'])
def register_user():
    """Register a new user and generate an API key."""
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing username or password'}), 400
    
    username = data['username']
    password = data['password']
    
    # Check if user already exists
    if username in users_db:
        return jsonify({'error': 'User already exists'}), 409
    
    # Hash the password
    hashed_password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    
    # Store user
    users_db[username] = {
        'username': username,
        'password': hashed_password,
        'created_at': datetime.utcnow().isoformat(),
        'api_keys': []
    }
    
    # Generate API key for the user
    api_key = generate_api_key(username)
    users_db[username]['api_keys'].append(api_key)
    
    return jsonify({
        'message': 'User registered successfully',
        'username': username,
        'api_key': api_key,
        'note': 'Store this API key securely. You will not be able to see it again.'
    }), 201


@app.route('/api/users/login', methods=['POST'])
def login_user():
    """Login user and optionally generate a new API key."""
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing username or password'}), 400
    
    username = data['username']
    password = data['password']
    
    # Check if user exists
    if username not in users_db:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    user = users_db[username]
    
    # Verify password
    if not bcrypt.checkpw(password.encode(), user['password'].encode()):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Generate a new API key for this login
    new_api_key = generate_api_key(username)
    user['api_keys'].append(new_api_key)
    
    # Also generate a JWT token for session management
    token = jwt.encode({
        'username': username,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'message': 'Login successful',
        'username': username,
        'api_key': new_api_key,
        'token': token
    }), 200


@app.route('/api/protected', methods=['GET'])
def protected_route():
    """Example protected route that requires API key authentication."""
    api_key = request.headers.get('X-API-Key')
    
    if not api_key:
        return jsonify({'error': 'Missing API key'}), 401
    
    user_info = validate_api_key(api_key)
    
    if not user_info:
        return jsonify({'error': 'Invalid API key'}), 401
    
    return jsonify({
        'message': 'Access granted',
        'user_id': user_info['user_id'],
        'last_used': user_info['last_used']
    }), 200


@app.route('/api/users/<username>/api-keys', methods=['GET'])
def get_user_api_keys(username):
    """Get all API keys for a user (requires authentication)."""
    auth_token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not auth_token:
        return jsonify({'error': 'Missing authorization token'}), 401
    
    try:
        payload = jwt.decode(auth_token, app.config['SECRET_KEY'], algorithms=['HS256'])
        if payload['username'] != username:
            return jsonify({'error': 'Unauthorized'}), 403
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    
    if username not in users_db:
        return jsonify({'error': 'User not found'}), 404
    
    user = users_db[username]
    api_keys_info = []
    
    for api_key in user['api_keys']:
        hashed_key = hashlib.sha256(api_key.encode()).hexdigest()
        if hashed_key in api_keys_db:
            key_info = api_keys_db[hashed_key]
            api_keys_info.append({
                'key_preview': api_key[:10] + '...',
                'created_at': key_info['created_at'],
                'last_used': key_info['last_used'],
                'is_active': key_info['is_active']
            })
    
    return jsonify({
        'username': username,
        'api_keys': api_keys_info
    }), 200


@app.route('/api/users/<username>/api-keys/<key_preview>/revoke', methods=['POST'])
def revoke_api_key(username, key_preview):
    """Revoke a specific API key for a user."""
    auth_token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not auth_token:
        return jsonify({'error': 'Missing authorization token'}), 401
    
    try:
        payload = jwt.decode(auth_token, app.config['SECRET_KEY'], algorithms=['HS256'])
        if payload['username'] != username:
            return jsonify({'error': 'Unauthorized'}), 403
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    
    if username not in users_db:
        return jsonify