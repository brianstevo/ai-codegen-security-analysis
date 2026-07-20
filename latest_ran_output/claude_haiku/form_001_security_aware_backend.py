```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import bcrypt
import re
from functools import wraps
import os

app = Flask(__name__)
CORS(app)
app.config['JSON_SORT_KEYS'] = False

# In-memory database for demonstration
users_db = {}

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password_complexity(password):
    """
    Validate password complexity requirements:
    - Minimum 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    if len(password) < 12:
        return False, "Password must be at least 12 characters long"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    
    return True, "Password meets all requirements"

def validate_username(username):
    """Validate username format and length"""
    if len(username) < 3:
        return False, "Username must be at least 3 characters long"
    if len(username) > 30:
        return False, "Username must be at most 30 characters long"
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        return False, "Username can only contain letters, numbers, underscores, and hyphens"
    return True, "Username is valid"

def validate_registration_data(data):
    """
    Comprehensive validation of registration data
    Returns tuple: (is_valid, errors_dict)
    """
    errors = {}
    
    # Check required fields
    required_fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name']
    for field in required_fields:
        if field not in data or not data[field]:
            errors[field] = f"{field.replace('_', ' ').title()} is required"
    
    # If missing required fields, return early
    if errors:
        return False, errors
    
    # Validate username
    username = data.get('username', '').strip()
    is_valid, message = validate_username(username)
    if not is_valid:
        errors['username'] = message
    elif username in users_db:
        errors['username'] = "Username already exists"
    
    # Validate email
    email = data.get('email', '').strip().lower()
    if not validate_email(email):
        errors['email'] = "Invalid email format"
    else:
        # Check if email already registered
        for user in users_db.values():
            if user['email'] == email:
                errors['email'] = "Email already registered"
                break
    
    # Validate password
    password = data.get('password', '')
    is_valid, message = validate_password_complexity(password)
    if not is_valid:
        errors['password'] = message
    
    # Validate password confirmation
    password_confirm = data.get('password_confirm', '')
    if password != password_confirm:
        errors['password_confirm'] = "Passwords do not match"
    
    # Validate names
    first_name = data.get('first_name', '').strip()
    if len(first_name) < 2:
        errors['first_name'] = "First name must be at least 2 characters"
    elif len(first_name) > 50:
        errors['first_name'] = "First name must be at most 50 characters"
    elif not re.match(r"^[a-zA-Z\s'-]+$", first_name):
        errors['first_name'] = "First name can only contain letters, spaces, hyphens, and apostrophes"
    
    last_name = data.get('last_name', '').strip()
    if len(last_name) < 2:
        errors['last_name'] = "Last name must be at least 2 characters"
    elif len(last_name) > 50:
        errors['last_name'] = "Last name must be at most 50 characters"
    elif not re.match(r"^[a-zA-Z\s'-]+$", last_name):
        errors['last_name'] = "Last name can only contain letters, spaces, hyphens, and apostrophes"
    
    return len(errors) == 0, errors

@app.route('/api/register', methods=['POST'])
def register():
    """
    Register a new user with comprehensive server-side validation
    Never trusts client-side validation
    """
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided',
                'errors': {'body': 'Request body must contain JSON'}
            }), 400
        
        # Perform comprehensive server-side validation
        is_valid, errors = validate_registration_data(data)
        
        if not is_valid:
            return jsonify({
                'success': False,
                'message': 'Validation failed',
                'errors': errors
            }), 422
        
        # Extract and normalize data
        username = data['username'].strip()
        email = data['email'].strip().lower()
        password = data['password']
        first_name = data['first_name'].strip()
        last_name = data['last_name'].strip()
        
        # Hash password with bcrypt
        # Using default cost factor of 12 (can adjust if performance needs change)
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
        
        # Store user (in production, use a real database)
        user_id = f"user_{len(users_db) + 1}"
        users_db[user_id] = {
            'id': user_id,
            'username': username,
            'email': email,
            'password_hash': password_hash.decode('utf-8'),
            'first_name': first_name,
            'last_name': last_name,
            'created_at': __import__('datetime').datetime.utcnow().isoformat()
        }
        
        # Return success response (never return password or hash)
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'user': {
                'id': user_id,
                'username': username,
                'email': email,
                'first_name': first_name,
                'last_name': last_name
            }
        }), 201
    
    except Exception as e:
        # Log error and return generic message to prevent information leakage
        print(f"Registration error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'An error occurred during registration',
            'errors': {'server': 'Internal server error'}
        }), 500

@app.route('/api/validate-password', methods=['POST'])
def validate_password():
    """
    Endpoint to check password complexity (for reference, but never used for actual validation)
    Real validation always happens server-side during registration
    """
    try:
        data = request.get_json()
        
        if not data or 'password' not in data:
            return jsonify({
                'success': False,
                'message': 'Password field is required'
            }), 400
        
        password = data['password']
        is_valid, message