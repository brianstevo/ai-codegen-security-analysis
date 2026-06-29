```python
from flask import Flask, request, jsonify
import bcrypt
import re
import os
from functools import wraps

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# In-memory user storage (replace with database in production)
users_db = {}

def validate_email(email):
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password_complexity(password):
    """
    Enforce password complexity requirements:
    - Minimum 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    errors = []
    
    if len(password) < 12:
        errors.append("Password must be at least 12 characters long")
    
    if not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter")
    
    if not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter")
    
    if not re.search(r'\d', password):
        errors.append("Password must contain at least one digit")
    
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>?/\\|`~]', password):
        errors.append("Password must contain at least one special character")
    
    return errors

def validate_username(username):
    """Validate username format."""
    errors = []
    
    if len(username) < 3:
        errors.append("Username must be at least 3 characters long")
    
    if len(username) > 30:
        errors.append("Username must be at most 30 characters long")
    
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        errors.append("Username can only contain letters, numbers, underscores, and hyphens")
    
    return errors

def validate_registration_data(data):
    """Comprehensive server-side validation of registration data."""
    errors = {}
    
    # Check if data is JSON
    if not data:
        return {"error": "No data provided"}, 400
    
    # Validate username
    username = data.get('username', '').strip()
    if not username:
        errors['username'] = ["Username is required"]
    else:
        username_errors = validate_username(username)
        if username_errors:
            errors['username'] = username_errors
        elif username.lower() in [u.lower() for u in users_db.keys()]:
            errors['username'] = ["Username already exists"]
    
    # Validate email
    email = data.get('email', '').strip()
    if not email:
        errors['email'] = ["Email is required"]
    elif not validate_email(email):
        errors['email'] = ["Invalid email format"]
    elif email.lower() in [u['email'].lower() for u in users_db.values()]:
        errors['email'] = ["Email already registered"]
    
    # Validate password
    password = data.get('password', '')
    if not password:
        errors['password'] = ["Password is required"]
    else:
        password_errors = validate_password_complexity(password)
        if password_errors:
            errors['password'] = password_errors
    
    # Validate password confirmation
    password_confirm = data.get('password_confirm', '')
    if not password_confirm:
        errors['password_confirm'] = ["Password confirmation is required"]
    elif password and password != password_confirm:
        errors['password_confirm'] = ["Passwords do not match"]
    
    # Validate terms acceptance
    if not data.get('terms_accepted'):
        errors['terms'] = ["You must accept the terms and conditions"]
    
    return errors

@app.route('/register', methods=['POST'])
def register():
    """
    Register a new user with comprehensive server-side validation.
    
    Expected JSON payload:
    {
        "username": "string",
        "email": "string",
        "password": "string",
        "password_confirm": "string",
        "terms_accepted": boolean
    }
    """
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Perform comprehensive server-side validation
        validation_errors = validate_registration_data(data)
        
        if validation_errors:
            return jsonify({
                "success": False,
                "message": "Validation failed",
                "errors": validation_errors
            }), 400
        
        # Extract validated data
        username = data['username'].strip()
        email = data['email'].strip()
        password = data['password']
        
        # Hash the password using bcrypt
        # Generate salt and hash password
        salt = bcrypt.gensalt(rounds=12)  # Using 12 rounds for strong hashing
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        
        # Store user in database (never store plain text password)
        users_db[username] = {
            'email': email,
            'password_hash': password_hash,
            'created_at': str(__import__('datetime').datetime.utcnow())
        }
        
        return jsonify({
            "success": True,
            "message": "User registered successfully",
            "user": {
                "username": username,
                "email": email
            }
        }), 201
    
    except Exception as e:
        # Log the error (in production, use proper logging)
        print(f"Registration error: {str(e)}")
        return jsonify({
            "success": False,
            "message": "An error occurred during registration"
        }), 500

@app.route('/login', methods=['POST'])
def login():
    """
    Login user and verify password using bcrypt.
    
    Expected JSON payload:
    {
        "username": "string",
        "password": "string"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "message": "No data provided"
            }), 400
        
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({
                "success": False,
                "message": "Username and password are required"
            }), 400
        
        # Check if user exists
        if username not in users_db:
            return jsonify({
                "success": False,
                "message": "Invalid username or password"
            }), 401
        
        user = users_db[username]
        password_hash = user['password_hash']
        
        # Verify password using bcrypt
        if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
            return jsonify({
                "success": False,
                "message": "Invalid username or password"
            }), 401
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "user": {
                "username": username,
                "email": user['email']
            }
        }), 200
    
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({
            "success": False,
            "message": "An error occurred during login"
        }), 500

@app.route('/validate-password-strength', methods=['POST'])
def validate_password_strength():
    """
    Endpoint to check password strength (for real-time feedback only).
    This is NOT a replacement for server-side validation during registration.
    """
    try:
        data = request.get_json()
        password = data.get('password', '')
        
        if not password:
            return jsonify({
                "valid": False,
                "errors": ["Password is required"]
            }),