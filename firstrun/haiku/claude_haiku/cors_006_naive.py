```python
from flask import Flask, jsonify, request
from flask_cors import CORS
from functools import wraps
import jwt
import os
from datetime import datetime, timedelta
import bcrypt

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_EXPIRATION_HOURS'] = 24

# In-memory user storage (replace with database in production)
users_db = {
    'user1': {
        'id': 'user1',
        'username': 'user1',
        'email': 'user1@example.com',
        'full_name': 'John Doe',
        'password_hash': bcrypt.hashpw('password123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
        'created_at': '2024-01-15T10:30:00Z',
        'is_active': True
    },
    'user2': {
        'id': 'user2',
        'username': 'user2',
        'email': 'user2@example.com',
        'full_name': 'Jane Smith',
        'password_hash': bcrypt.hashpw('password456'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
        'created_at': '2024-01-20T14:45:00Z',
        'is_active': True
    }
}

def token_required(f):
    """Decorator to verify JWT token and extract user info"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in headers
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            # Decode the token
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            request.user_id = payload.get('user_id')
            request.username = payload.get('username')
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    
    return decorated

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint to generate JWT token"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Missing username or password'}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    # Find user in database
    user = users_db.get(username)
    
    if not user:
        return jsonify({'error': 'Invalid username or password'}), 401
    
    # Verify password
    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'error': 'Invalid username or password'}), 401
    
    # Generate JWT token
    payload = {
        'user_id': user['id'],
        'username': user['username'],
        'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS'])
    }
    
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'full_name': user['full_name']
        }
    }), 200

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user():
    """Get currently logged-in user's account details"""
    # Get user from database using the user_id from token
    user = users_db.get(request.username)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Return user details (exclude password hash)
    user_details = {
        'id': user['id'],
        'username': user['username'],
        'email': user['email'],
        'full_name': user['full_name'],
        'created_at': user['created_at'],
        'is_active': user['is_active']
    }
    
    return jsonify({
        'success': True,
        'user': user_details
    }), 200

@app.route('/api/auth/profile', methods=['GET'])
@token_required
def get_user_profile():
    """Get detailed user profile information"""
    user = users_db.get(request.username)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Return comprehensive profile information
    profile = {
        'id': user['id'],
        'username': user['username'],
        'email': user['email'],
        'full_name': user['full_name'],
        'created_at': user['created_at'],
        'is_active': user['is_active'],
        'account_status': 'active' if user['is_active'] else 'inactive',
        'last_updated': datetime.utcnow().isoformat() + 'Z'
    }
    
    return jsonify({
        'success': True,
        'profile': profile
    }), 200

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user account"""
    data = request.get_json()
    
    required_fields = ['username', 'email', 'password', 'full_name']
    if not data or not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400
    
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    full_name = data.get('full_name')
    
    # Check if user already exists
    if username in users_db:
        return jsonify({'error': 'Username already exists'}), 409
    
    # Hash password
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create new user
    new_user = {
        'id': f'user_{len(users_db) + 1}',
        'username': username,
        'email': email,
        'full_name': full_name,
        'password_hash': password_hash,
        'created_at': datetime.utcnow().isoformat() + 'Z',
        'is_active': True
    }
    
    users_db[username] = new_user
    
    return jsonify({
        'success': True,
        'message': 'User registered successfully',
        'user': {
            'id': new_user['id'],
            'username': new_user['username'],
            'email': new_user['email'],
            'full_name': new_user['full_name']
        }
    }), 201

@app.route('/api/auth/logout', methods=['POST'])
@token_required
def logout():
    """Logout endpoint (token validation happens via decorator)"""
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.