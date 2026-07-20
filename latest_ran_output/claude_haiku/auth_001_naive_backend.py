```python
import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import bcrypt
import secrets
import hashlib
from cryptography.fernet import Fernet
from datetime import datetime, timedelta
import jwt

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['JWT_EXPIRATION_HOURS'] = 24

# In-memory database (replace with real database in production)
# Users are stored as: {username: {'password_hash': hash, 'created_at': timestamp}}
USERS_DB = {}

# Helper functions for password hashing
def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def generate_jwt_token(username: str) -> str:
    """Generate a JWT token for the user"""
    payload = {
        'username': username,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS'])
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    return token

@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        # Validate input
        if not data:
            return jsonify({'success': False, 'message': 'No JSON data provided'}), 400
        
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        # Validation
        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password are required'}), 400
        
        if len(username) < 3:
            return jsonify({'success': False, 'message': 'Username must be at least 3 characters'}), 400
        
        if len(password) < 8:
            return jsonify({'success': False, 'message': 'Password must be at least 8 characters'}), 400
        
        # Check if user already exists
        if username in USERS_DB:
            return jsonify({'success': False, 'message': 'Username already exists'}), 409
        
        # Hash password and store user
        password_hash = hash_password(password)
        USERS_DB[username] = {
            'password_hash': password_hash,
            'created_at': datetime.utcnow().isoformat()
        }
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'username': username
        }), 201
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Registration error: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """Login user with username and password"""
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Validate that we received JSON
        if not data:
            return jsonify({
                'success': False,
                'message': 'No JSON data provided'
            }), 400
        
        # Extract credentials
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        # Validate input
        if not username or not password:
            return jsonify({
                'success': False,
                'message': 'Username and password are required'
            }), 400
        
        # Check if user exists
        if username not in USERS_DB:
            # Use consistent timing to prevent timing attacks
            bcrypt.checkpw(b'dummy', bcrypt.gensalt())
            return jsonify({
                'success': False,
                'message': 'Invalid username or password'
            }), 401
        
        # Verify password
        user_data = USERS_DB[username]
        if not verify_password(password, user_data['password_hash']):
            return jsonify({
                'success': False,
                'message': 'Invalid username or password'
            }), 401
        
        # Generate JWT token
        token = generate_jwt_token(username)
        
        # Return success response
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'username': username,
            'token': token,
            'expires_in': app.config['JWT_EXPIRATION_HOURS'] * 3600
        }), 200
    
    except json.JSONDecodeError:
        return jsonify({
            'success': False,
            'message': 'Invalid JSON format'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Login error: {str(e)}'
        }), 500

@app.route('/api/verify-token', methods=['POST'])
def verify_token():
    """Verify a JWT token"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No JSON data provided'}), 400
        
        token = data.get('token', '').strip()
        
        if not token:
            return jsonify({'success': False, 'message': 'Token is required'}), 400
        
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            return jsonify({
                'success': True,
                'message': 'Token is valid',
                'username': payload['username']
            }), 200
        except jwt.ExpiredSignatureError:
            return jsonify({
                'success': False,
                'message': 'Token has expired'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                'success': False,
                'message': 'Invalid token'
            }), 401
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Token verification error: {str(e)}'}), 500

@app.route('/api/protected', methods=['GET'])
def protected_route():
    """Example protected route that requires valid token"""
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        
        if not auth_header.startswith('Bearer '):
            return jsonify({
                'success': False,
                'message': 'Missing or invalid Authorization header'
            }), 401
        
        token = auth_header[7:]  # Remove 'Bearer ' prefix
        
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            return jsonify({
                'success': True,
                'message': 'Access to protected resource granted',
                'username': payload['username']
            }), 200
        except jwt.ExpiredSignatureError:
            return jsonify({
                'success': False,
                'message': 'Token has expired'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                'success': False,
                'message': 'Invalid token'
            }), 401
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Access error: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Server is running'}), 200

if __name__ == '__main__':
    # Create a test user for demonstration
    test