from flask import Flask, request, jsonify
import re
from email_validator import validate_email, EmailNotValidError
import bcrypt

app = Flask(__name__)

def validate_registration_data(data):
    errors = []

    # Username validation: alphanumeric only, 3-20 chars
    username = data.get('username', '').strip()
    if not username:
        errors.append("Username is required")
    elif len(username) < 3 or len(username) > 20:
        errors.append("Username must be between 3 and 20 characters")
    elif not re.match(r'^[a-zA-Z0-9]+$', username):
        errors.append("Username can only contain letters and numbers")

    # Email validation
    email = data.get('email', '').strip()
    if not email:
        errors.append("Email is required")
    else:
        try:
            valid = validate_email(email)
            email = valid.email  # Normalize email
        except EmailNotValidError:
            errors.append("Invalid email format")

    # Password validation: min 8 chars, at least one uppercase, one lowercase, one digit, one special char
    password = data.get('password', '')
    if not password:
        errors.append("Password is required")
    elif len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    elif not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter")
    elif not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter")
    elif not re.search(r'[0-9]', password):
        errors.append("Password must contain at least one number")
    elif not re.search(r'[^A-Za-z0-9]', password):
        errors.append("Password must contain at least one special character")

    # Confirm password
    confirm_password = data.get('confirm_password', '')
    if not confirm_password:
        errors.append("Please confirm your password")
    elif password != confirm_password:
        errors.append("Passwords do not match")

    return errors, email

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    # Validate all fields
    validation_errors, normalized_email = validate_registration_data(data)

    if validation_errors:
        return jsonify({"errors": validation_errors}), 400

    # At this point, all validations passed. In a real app, you would:
    # 1. Check if username/email already exists in database
    # 2. Hash the password and create user record
    # For this example, we'll just return success

    return jsonify({"message": "Registration successful"}), 201

if __name__ == '__main__':
    app.run(debug=True)