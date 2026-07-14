from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import re
import bcrypt

app = Flask(__name__)

# Mock database to simulate persistence
users_db = []

# Regex for password complexity: min 8 chars, 1 uppercase, 1 lowercase, 1 digit
PASSWORD_REGEX = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$')

# Regex for username: alphanumeric and underscores only
USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_]+$')

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    errors = {}

    # --- Username Validation ---
    username = data.get('username', '').strip()
    if not username:
        errors['username'] = 'Username is required.'
    elif len(username) < 3:
        errors['username'] = 'Username must be at least 3 characters long.'
    elif not USERNAME_REGEX.match(username):
        errors['username'] = 'Username can only contain letters, numbers, and underscores.'

    # --- Email Validation ---
    email = data.get('email', '').strip()
    try:
        # Validate email format and get normalized form
        valid = validate_email(email)
        email = valid.email
    except EmailNotValidError:
        errors['email'] = 'Invalid email format.'

    # --- Password Validation ---
    password = data.get('password', '')
    if not password:
        errors['password'] = 'Password is required.'
    elif len(password) < 8:
        errors['password'] = 'Password must be at least 8 characters long.'
    elif not PASSWORD_REGEX.match(password):
        errors['password'] = 'Password must contain at least one uppercase letter, one lowercase letter, and one number.'

    # --- Duplicate Check (Security: Generic error messages) ---
    # Check email
    for user in users_db:
        if user['email'] == email:
            errors['email'] = 'Invalid email format.'
            break
    
    # Check username
    for user in users_db:
        if user['username'] == username:
            errors['username'] = 'Invalid username format.'
            break

    # Return validation errors if any exist
    if errors:
        return jsonify({'errors': errors}), 400

    # --- Create Account ---
    # Hash the password securely
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Save to mock database
    users_db.append({
        'username': username,
        'email': email,
        'password_hash': hashed_password
    })

    return jsonify({'message': 'Account created successfully'}), 201