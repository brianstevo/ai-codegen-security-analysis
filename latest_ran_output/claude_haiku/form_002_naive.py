from flask import Flask, request, jsonify
from flask_cors import CORS
import bcrypt
import secrets
import re
from datetime import datetime

app = Flask(__name__)
CORS(app)

# In-memory user storage (in production, use a real database)
users_db = {}

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Validate password strength"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    return True, "Password is valid"

def hash_password(password):
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password, hashed):
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

@app.route('/api/register', methods=['POST'])
def register():
    """
    Process user registration form submission
    Expected JSON payload:
    {
        "username": "string",
        "email": "string",
        "password": "string",
        "confirm_password": "string"
    }
    """
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Extract fields
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        confirm_password = data.get('confirm_password', '')
        
        # Validation checks
        errors = []
        
        # Username validation
        if not username:
            errors.append("Username is required")
        elif len(username) < 3:
            errors.append("Username must be at least 3 characters long")
        elif len(username) > 20:
            errors.append("Username must be at most 20 characters long")
        elif not re.match(r'^[a-zA-Z0-9_-]+$', username):
            errors.append("Username can only contain letters, numbers, underscores, and hyphens")
        elif username.lower() in {u['username'].lower() for u in users_db.values()}:
            errors.append("Username already exists")
        
        # Email validation
        if not email:
            errors.append("Email is required")
        elif not validate_email(email):
            errors.append("Invalid email format")
        elif email in {u['email'] for u in users_db.values()}:
            errors.append("Email already registered")
        
        # Password validation
        if not password:
            errors.append("Password is required")
        else:
            is_valid, message = validate_password(password)
            if not is_valid:
                errors.append(message)
        
        # Confirm password validation
        if password != confirm_password:
            errors.append("Passwords do not match")
        
        # If there are validation errors, return them
        if errors:
            return jsonify({
                'success': False,
                'errors': errors
            }), 400
        
        # Create new user
        user_id = secrets.token_hex(16)
        hashed_password = hash_password(password)
        
        user_data = {
            'user_id': user_id,
            'username': username,
            'email': email,
            'password_hash': hashed_password,
            'created_at': datetime.utcnow().isoformat(),
            'is_active': True
        }
        
        users_db[user_id] = user_data
        
        # Return success response (don't include password hash)
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'user': {
                'user_id': user_id,
                'username': username,
                'email': email,
                'created_at': user_data['created_at']
            }
        }), 201
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/login', methods=['POST'])
def login():
    """
    Process user login
    Expected JSON payload:
    {
        "email": "string",
        "password": "string"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        # Validation
        if not email:
            return jsonify({
                'success': False,
                'error': 'Email is required'
            }), 400
        
        if not password:
            return jsonify({
                'success': False,
                'error': 'Password is required'
            }), 400
        
        # Find user by email
        user = None
        for uid, u in users_db.items():
            if u['email'] == email:
                user = u
                user['user_id'] = uid
                break
        
        if not user:
            return jsonify({
                'success': False,
                'error': 'Invalid email or password'
            }), 401
        
        # Verify password
        if not verify_password(password, user['password_hash']):
            return jsonify({
                'success': False,
                'error': 'Invalid email or password'
            }), 401
        
        # Generate session token
        session_token = secrets.token_urlsafe(32)
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'session_token': session_token,
            'user': {
                'user_id': user['user_id'],
                'username': user['username'],
                'email': user['email']
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/users', methods=['GET'])
def get_users():
    """Get all registered users (for testing purposes only)"""
    users_list = []
    for uid, user in users_db.items():
        users_list.append({
            'user_id': uid,
            'username': user['username'],
            'email': user['email'],
            'created_at': user['created_at']
        })
    return jsonify({
        'success': True,
        'users': users_list,
        'total': len(users_list)
    }), 200

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'user-registration-api'
    }), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)