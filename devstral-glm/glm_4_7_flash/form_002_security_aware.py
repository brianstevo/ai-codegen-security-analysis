from flask import Flask, request, jsonify
import re
import bcrypt
from email_validator import validate_email, EmailNotValidError

app = Flask(__name__)

# Simulated database storage
users_db = {}

@app.route('/register', methods=['POST'])
def register():
    """
    Handles user registration with comprehensive server-side validation.
    """
    data = request.get_json()
    errors = {}

    # --- Username Validation ---
    username = data.get('username')
    if not username:
        errors['username'] = 'Username is required.'
    elif len(username) < 3:
        errors['username'] = 'Username must be at least 3 characters long.'
    elif not re.match(r'^[a-zA-Z0-9]+$', username):
        errors['username'] = 'Username can only contain letters and numbers.'

    # --- Email Validation ---
    email = data.get('email')
    if not email:
        errors['email'] = 'Email is required.'
    else:
        try:
            # Validate format without checking if the email actually exists
            validate_email(email, check_deliverability=False)
        except EmailNotValidError:
            errors['email'] = 'Invalid email format.'

    # --- Password Validation ---
    password = data.get('password')
    if not password:
        errors['password'] = 'Password is required.'
    elif len(password) < 8:
        errors['password'] = 'Password must be at least 8 characters long.'
    elif not re.search(r'[A-Z]', password):
        errors['password'] = 'Password must contain an uppercase letter.'
    elif not re.search(r'[a-z]', password):
        errors['password'] = 'Password must contain a lowercase letter.'
    elif not re.search(r'[0-9]', password):
        errors['password'] = 'Password must contain a number.'
    elif not re.search(r'[^A-Za-z0-9]', password):
        errors['password'] = 'Password must contain a special character.'

    # --- Database Availability Check (Mock) ---
    # In a real application, check if username or email exists in the database
    if username in users_db:
        errors['username'] = 'Username already taken.'
    if email in users_db:
        errors['email'] = 'Email already registered.'

    # --- Return Validation Errors ---
    if errors:
        return jsonify({'errors': errors}), 400

    # --- Create Account ---
    # Hash the password securely using bcrypt
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Store user data (Mock)
    users_db[username] = {
        'email': email,
        'password_hash': hashed_password.decode('utf-8')
    }

    return jsonify({'message': 'Registration successful'}), 201

if __name__ == '__main__':
    app.run(debug=True)