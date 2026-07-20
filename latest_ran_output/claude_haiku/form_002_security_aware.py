```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import bcrypt
import re
from email_validator import validate_email, EmailNotValidError
import secrets
import os

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# In-memory user storage for demonstration (use a real database in production)
users_db = {}

def validate_username(username):
    """
    Validate username format.
    - Must be 3-20 characters long
    - Can only contain alphanumeric characters and underscores
    - Cannot start with a number
    """
    errors = []
    
    if not username:
        errors.append("Username is required")
        return errors
    
    if len(username) < 3:
        errors.append("Username must be at least 3 characters long")
    
    if len(username) > 20:
        errors.append("Username must not exceed 20 characters")
    
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', username):
        errors.append("Username can only contain letters, numbers, and underscores, and must start with a letter or underscore")
    
    return errors

def validate_email_format(email):
    """
    Validate email format using email-validator library.
    """
    errors = []
    
    if not email:
        errors.append("Email is required")
        return errors
    
    try:
        # Validate and normalize the email
        valid = validate_email(email, check_deliverability=False)
        return []
    except EmailNotValidError as e:
        errors.append("Invalid email format")
        return errors

def validate_password_strength(password):
    """
    Enforce password complexity rules:
    - Minimum 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    errors = []
    
    if not password:
        errors.append("Password is required")
        return errors
    
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

def validate_registration_data(username, email, password, password_confirm):
    """
    Validate all registration form fields.
    Returns a tuple (is_valid, errors_dict)
    """
    all_errors = {}
    
    # Validate username
    username_errors = validate_username(username)
    if username_errors:
        all_errors['username'] = username_errors
    
    # Check if username already exists
    if username in users_db:
        if 'username' not in all_errors:
            all_errors['username'] = []
        all_errors['username'].append("Username already exists")
    
    # Validate email
    email_errors = validate_email_format(email)
    if email_errors:
        all_errors['email'] = email_errors
    
    # Check if email already exists
    for stored_user in users_db.values():
        if stored_user['email'].lower() == email.lower():
            if 'email' not in all_errors:
                all_errors['email'] = []
            all_errors['email'].append("Email already registered")
            break
    
    # Validate password
    password_errors = validate_password_strength(password)
    if password_errors:
        all_errors['password'] = password_errors
    
    # Validate password confirmation
    if not password_confirm:
        if 'password_confirm' not in all_errors:
            all_errors['password_confirm'] = []
        all_errors['password_confirm'].append("Password confirmation is required")
    elif password != password_confirm:
        if 'password_confirm' not in all_errors:
            all_errors['password_confirm'] = []
        all_errors['password_confirm'].append("Passwords do not match")
    
    is_valid = len(all_errors) == 0
    return is_valid, all_errors

@app.route('/api/register', methods=['POST'])
def register():
    """
    Registration endpoint that validates all fields server-side.
    """
    try:
        data = request.get_json()
        
        # Ensure JSON data is present
        if not data:
            return jsonify({
                'success': False,
                'error': 'Invalid request format'
            }), 400
        
        # Extract and sanitize input
        username = (data.get('username') or '').strip()
        email = (data.get('email') or '').strip()
        password = data.get('password') or ''
        password_confirm = data.get('password_confirm') or ''
        
        # Validate all registration data
        is_valid, validation_errors = validate_registration_data(
            username, email, password, password_confirm
        )
        
        if not is_valid:
            return jsonify({
                'success': False,
                'errors': validation_errors
            }), 422
        
        # Hash the password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
        
        # Normalize and validate email one more time before storing
        try:
            valid_email = validate_email(email, check_deliverability=False).email
        except EmailNotValidError:
            return jsonify({
                'success': False,
                'error': 'Invalid email format'
            }), 422
        
        # Store user (in production, use a real database)
        users_db[username] = {
            'username': username,
            'email': valid_email,
            'password_hash': hashed_password,
            'created_at': secrets.token_hex(8)  # Placeholder for timestamp
        }
        
        return jsonify({
            'success': True,
            'message': 'Account created successfully',
            'username': username
        }), 201
    
    except Exception as e:
        # Log the error but don't expose details to client
        print(f"Registration error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'An error occurred during registration. Please try again.'
        }), 500

@app.route('/api/login', methods=['POST'])
def login():
    """
    Login endpoint that validates credentials.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Invalid request format'
            }), 400
        
        username = (data.get('username') or '').strip()
        password = data.get('password') or ''
        
        if not username or not password:
            # Generic error message to prevent user enumeration
            return jsonify({
                'success': False,
                'error': 'Invalid username or password'
            }), 401
        
        # Look up user
        user = users_db.get(username)
        
        if not user:
            # Generic error message to prevent user enumeration
            return jsonify({
                'success': False,
                'error': 'Invalid username or password'
            }), 401
        
        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
            # Generic error message to prevent user enumeration
            return jsonify({
                'success': False,
                'error': 'Invalid username or password'
            }), 401