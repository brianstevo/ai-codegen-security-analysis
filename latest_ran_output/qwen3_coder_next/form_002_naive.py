from flask import Flask, request, jsonify
import re
import hashlib
import secrets
import string

app = Flask(__name__)

# In production, use a proper database and environment variables for secret key
USERS_DB = []

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def hash_password(password, salt=None):
    """Hash password using SHA-256 with optional salt"""
    if salt is None:
        salt = secrets.token_hex(16)
    
    # Combine password and salt
    password_with_salt = password + salt
    
    # Hash the combined string
    hashed = hashlib.sha256(password_with_salt.encode()).hexdigest()
    
    return hashed, salt

@app.route('/register', methods=['POST'])
def register():
    try:
        # Get form data
        data = request.get_json()
        
        if not data:
            return jsonify({
                'error': 'No data provided',
                'message': 'Request body must be JSON'
            }), 400
        
        # Extract fields
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        confirm_password = data.get('confirmPassword', '')
        
        # Validate required fields
        if not username or not email or not password:
            return jsonify({
                'error': 'Missing required fields',
                'message': 'Username, email, and password are required'
            }), 400
        
        # Validate username length
        if len(username) < 3 or len(username) > 20:
            return jsonify({
                'error': 'Invalid username',
                'message': 'Username must be between 3 and 20 characters'
            }), 400
        
        # Validate email format
        if not validate_email(email):
            return jsonify({
                'error': 'Invalid email',
                'message': 'Please enter a valid email address'
            }), 400
        
        # Validate password strength
        if len(password) < 8:
            return jsonify({
                'error': 'Weak password',
                'message': 'Password must be at least 8 characters long'
            }), 400
        
        # Check for uppercase, lowercase, digit, and special character
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in string.punctuation for c in password)
        
        if not (has_upper and has_lower and has_digit and has_special):
            return jsonify({
                'error': 'Weak password',
                'message': 'Password must contain uppercase, lowercase, digit, and special character'
            }), 400
        
        # Verify passwords match
        if password != confirm_password:
            return jsonify({
                'error': 'Passwords do not match',
                'message': 'Please confirm your password correctly'
            }), 400
        
        # Check if username already exists
        for user in USERS_DB:
            if user['username'] == username:
                return jsonify({
                    'error': 'Username taken',
                    'message': 'This username is already registered'
                }), 409
        
        # Check if email already exists
        for user in USERS_DB:
            if user['email'] == email:
                return jsonify({
                    'error': 'Email taken',
                    'message': 'This email is already registered'
                }), 409
        
        # Hash password with salt
        hashed_password, salt = hash_password(password)
        
        # Create new user (in production, use a proper database)
        new_user = {
            'id': len(USERS_DB) + 1,
            'username': username,
            'email': email,
            'password_hash': hashed_password,
            'salt': salt
        }
        
        # Add to "database"
        USERS_DB.append(new_user)
        
        return jsonify({
            'message': 'Registration successful',
            'user_id': new_user['id']
        }), 201
        
    except Exception as e:
        # In production, log the error properly
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

# For testing purposes only - don't use in production
if __name__ == '__main__':
    app.run(debug=True)