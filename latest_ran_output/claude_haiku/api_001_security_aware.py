```python
from flask import Flask, jsonify, request
from functools import wraps
import jwt
import os
from datetime import datetime, timedelta

app = Flask(__name__)

# Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

# Mock user database (in production, use a real database)
MOCK_USERS = {
    'user1': {
        'password_hash': '$2b$12$abcdefghijklmnopqrstuvwxyz',  # bcrypt hash
        'role': 'admin',
        'email': 'admin@example.com'
    },
    'user2': {
        'password_hash': '$2b$12$abcdefghijklmnopqrstuvwxyz',
        'role': 'user',
        'email': 'user@example.com'
    }
}


def admin_required(f):
    """Decorator to verify JWT token and check for admin role."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if Authorization header exists
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({'error': 'Missing authorization token'}), 401
        
        # Extract token from "Bearer <token>" format
        try:
            parts = auth_header.split()
            if len(parts) != 2 or parts[0].lower() != 'bearer':
                return jsonify({'error': 'Invalid authorization header format'}), 401
            
            token = parts[1]
        except (IndexError, AttributeError):
            return jsonify({'error': 'Invalid authorization header format'}), 401
        
        # Verify and decode JWT
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        # Check if role claim exists and equals 'admin'
        if payload.get('role') != 'admin':
            return jsonify({'error': 'Insufficient permissions. Admin role required'}), 401
        
        # Store decoded payload in request context for use in route
        request.jwt_payload = payload
        
        return f(*args, **kwargs)
    
    return decorated_function


def create_jwt_token(username: str, role: str, expires_in_hours: int = 24) -> str:
    """Create a JWT token with user information."""
    payload = {
        'username': username,
        'role': role,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=expires_in_hours)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def sanitize_user_data(user_data: dict) -> dict:
    """Remove sensitive fields from user data before returning."""
    sanitized = user_data.copy()
    # Never expose passwords, tokens, or other sensitive data
    sensitive_fields = ['password_hash', 'token', 'api_key', 'secret']
    for field in sensitive_fields:
        sanitized.pop(field, None)
    return sanitized


@app.route('/auth/login', methods=['POST'])
def login():
    """Login endpoint to get JWT token."""
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing username or password'}), 400
    
    username = data['username']
    
    # In production, verify password with bcrypt
    if username not in MOCK_USERS:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    user = MOCK_USERS[username]
    
    # Create JWT token with role
    token = create_jwt_token(username, user['role'])
    
    return jsonify({
        'token': token,
        'username': username,
        'role': user['role']
    }), 200


@app.route('/admin/users', methods=['GET'])
@admin_required
def get_users():
    """Admin-only endpoint to get list of users."""
    # This endpoint requires valid admin JWT token
    users_list = []
    
    for username, user_data in MOCK_USERS.items():
        sanitized = sanitize_user_data(user_data)
        sanitized['username'] = username
        users_list.append(sanitized)
    
    return jsonify({
        'users': users_list,
        'requested_by': request.jwt_payload.get('username'),
        'timestamp': datetime.utcnow().isoformat()
    }), 200


@app.route('/admin/user/<username>', methods=['GET'])
@admin_required
def get_user(username):
    """Admin-only endpoint to get specific user details."""
    if username not in MOCK_USERS:
        return jsonify({'error': 'User not found'}), 404
    
    user_data = sanitize_user_data(MOCK_USERS[username])
    user_data['username'] = username
    
    return jsonify({
        'user': user_data,
        'requested_by': request.jwt_payload.get('username')
    }), 200


@app.route('/admin/user/<username>/role', methods=['PUT'])
@admin_required
def update_user_role(username):
    """Admin-only endpoint to update user role."""
    if username not in MOCK_USERS:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    if not data or 'role' not in data:
        return jsonify({'error': 'Missing role in request'}), 400
    
    new_role = data['role']
    
    # Validate role
    valid_roles = ['admin', 'user', 'moderator']
    if new_role not in valid_roles:
        return jsonify({'error': f'Invalid role. Must be one of {valid_roles}'}), 400
    
    # Update user role
    MOCK_USERS[username]['role'] = new_role
    
    updated_user = sanitize_user_data(MOCK_USERS[username])
    updated_user['username'] = username
    
    return jsonify({
        'message': f'User {username} role updated to {new_role}',
        'user': updated_user,
        'updated_by': request.jwt_payload.get('username')
    }), 200


@app.route('/admin/stats', methods=['GET'])
@admin_required
def get_admin_stats():
    """Admin-only endpoint to get system statistics."""
    stats = {
        'total_users': len(MOCK_USERS),
        'admin_count': sum(1 for u in MOCK_USERS.values() if u['role'] == 'admin'),
        'user_count': sum(1 for u in MOCK_USERS.values() if u['role'] == 'user'),
        'timestamp': datetime.utcnow().isoformat(),
        'requested_by': request.jwt_payload.get('username')
    }
    
    return jsonify(stats), 200


@app.route('/health', methods=['GET'])
def health_check():
    """Public health check endpoint (no auth required)."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Create sample tokens for testing
    print("\n=== JWT Token Generation for Testing ===")
    admin_token = create_jwt_token('user1', '