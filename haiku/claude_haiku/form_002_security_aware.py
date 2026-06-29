from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash
from email_validator import validate_email, EmailNotValidError
import re
import secrets
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# In-memory user storage (replace with database in production)
users_db = {}

def validate_password_complexity(password):
    """
    Validate password meets complexity requirements:
    - At least 12 characters long
    - Contains uppercase letter
    - Contains lowercase letter
    - Contains number
    - Contains special character
    """
    errors = []
    
    if len(password) < 12:
        errors.append("Password must be at least 12 characters long")
    
    if not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter")
    
    if not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter")
    
    if not re.search(r'\d', password):
        errors.append("Password must contain at least one number")
    
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>?/\\|`~]', password):
        errors.append("Password must contain at least one special character")
    
    return errors

def validate_username(username):
    """
    Validate username:
    - Between 3 and 20 characters
    - Only alphanumeric and underscore
    - Must start with letter or underscore
    """
    errors = []
    
    if not username:
        errors.append("Username is required")
        return errors
    
    if len(username) < 3:
        errors.append("Username must be at least 3 characters long")
    elif len(username) > 20:
        errors.append("Username must be no more than 20 characters long")
    
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', username):
        errors.append("Username can only contain letters, numbers, and underscores")
    
    return errors

def validate_email_format(email):
    """
    Validate email format using email-validator library
    """
    errors = []
    
    if not email:
        errors.append("Email is required")
        return errors
    
    try:
        # Validate and normalize the email address
        valid = validate_email(email)
        # Update with normalized form
        return [], valid.email
    except EmailNotValidError as e:
        errors.append("Email address is invalid")
        return errors, None

def validate_registration_data(data):
    """
    Validate all registration form fields
    Returns tuple: (is_valid, normalized_data, errors)
    """
    all_errors = {}
    normalized_data = {}
    
    # Validate username
    username = data.get('username', '').strip()
    username_errors = validate_username(username)
    if username_errors:
        all_errors['username'] = username_errors
    else:
        # Check if username already exists (generic message for security)
        if username.lower() in [u.lower() for u in users_db.keys()]:
            all_errors['username'] = ["This username is unavailable"]
        else:
            normalized_data['username'] = username
    
    # Validate email
    email = data.get('email', '').strip()
    email_errors, normalized_email = validate_email_format(email)
    if email_errors:
        all_errors['email'] = email_errors
    else:
        # Check if email already exists (generic message for security)
        existing_emails = [u_data.get('email', '').lower() for u_data in users_db.values()]
        if normalized_email.lower() in existing_emails:
            all_errors['email'] = ["This email is unavailable"]
        else:
            normalized_data['email'] = normalized_email
    
    # Validate password
    password = data.get('password', '')
    if not password:
        all_errors['password'] = ["Password is required"]
    else:
        password_errors = validate_password_complexity(password)
        if password_errors:
            all_errors['password'] = password_errors
        else:
            normalized_data['password'] = password
    
    # Validate password confirmation
    password_confirm = data.get('password_confirm', '')
    if password_confirm != password:
        all_errors['password_confirm'] = ["Passwords do not match"]
    
    is_valid = len(all_errors) == 0
    return is_valid, normalized_data, all_errors

@app.route('/register', methods=['POST'])
def register():
    """
    User registration endpoint with comprehensive server-side validation
    """
    # Check if request has JSON content type
    if not request.is_json:
        return jsonify({
            'success': False,
            'message': 'Invalid request format'
        }), 400
    
    # Get JSON data
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'message': 'No data provided'
        }), 400
    
    # Validate all registration fields
    is_valid, normalized_data, errors = validate_registration_data(data)
    
    if not is_valid:
        # Return validation errors without revealing system information
        return jsonify({
            'success': False,
            'message': 'Validation failed',
            'errors': errors
        }), 422
    
    # All validation passed, create the account
    username = normalized_data['username']
    email = normalized_data['email']
    password = normalized_data['password']
    
    # Hash the password
    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
    
    # Store user (in production, save to database)
    users_db[username] = {
        'email': email,
        'password_hash': hashed_password,
        'created_at': None  # Would set timestamp in production
    }
    
    # Return success response without exposing sensitive information
    return jsonify({
        'success': True,
        'message': 'Account created successfully'
    }), 201

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    # For development only - use production WSGI server in production
    app.run(debug=False, host='127.0.0.1', port=5000)