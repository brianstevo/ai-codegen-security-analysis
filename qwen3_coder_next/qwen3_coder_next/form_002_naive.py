from flask import Blueprint, request, jsonify
import re
import hashlib
import secrets
import string

# Assuming you have a User model and database session set up
# from yourapp.models import db, User
# from yourapp.extensions import bcrypt

# Example blueprint setup
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    # Get form data
    email = request.form.get('email')
    username = request.form.get('username')
    password = request.form.get('password')
    confirm_password = request.form.get('confirm_password')
    
    # Validate required fields
    if not all([email, username, password]):
        return jsonify({'error': 'All fields are required'}), 400
    
    # Validate email format
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        return jsonify({'error': 'Invalid email format'}), 400
    
    # Validate username (alphanumeric and underscores only, 3-20 chars)
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
        return jsonify({'error': 'Username must be 3-20 characters and contain only letters, numbers, and underscores'}), 400
    
    # Validate password strength
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400
    
    # Check for uppercase, lowercase, digit, and special character in password
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in string.punctuation for c in password)
    
    if not (has_upper and has_lower and has_digit and has_special):
        return jsonify({'error': 'Password must contain at least one uppercase letter, lowercase letter, digit, and special character'}), 400
    
    # Check passwords match
    if password != confirm_password:
        return jsonify({'error': 'Passwords do not match'}), 400
    
    # Check if user already exists (assuming you have a User model)
    # user_by_email = User.query.filter_by(email=email).first()
    # user_by_username = User.query.filter_by(username=username).first()
    
    # Example placeholder for database check
    # In real implementation, replace with actual DB queries:
    # if user_by_email or user_by_username:
    #     return jsonify({'error': 'Email or username already exists'}), 409
    
    # Hash password using bcrypt (or another secure method)
    try:
        # salt = bcrypt.gensalt()
        # hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        
        # Alternative: use hashlib with salt for demonstration
        salt = secrets.token_hex(16)
        hashed_password = hashlib.pbkdf2_hmac(
            'sha256', 
            password.encode('utf-8'), 
            salt.encode('utf-8'), 
            100000
        ).hex()
        
        # Create new user (example implementation)
        # new_user = User(
        #     email=email,
        #     username=username,
        #     password_hash=hashed_password,
        #     salt=salt
        # )
        # db.session.add(new_user)
        # db.session.commit()
        
        return jsonify({
            'message': 'User registered successfully',
            'user_id': 123,  # In real implementation, this would be the new user's ID from DB
            'username': username,
            'email': email
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500