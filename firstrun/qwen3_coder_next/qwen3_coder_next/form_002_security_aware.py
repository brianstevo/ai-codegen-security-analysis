from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import re
import secrets

app = Flask(__name__)

def validate_username(username):
    """Validate username: only alphanumeric characters allowed"""
    if not username:
        return "Username is required"
    if len(username) < 3 or len(username) > 20:
        return "Username must be between 3 and 20 characters"
    if not re.match(r'^[a-zA-Z0-9]+$', username):
        return "Username can only contain letters and numbers"
    return None

def validate_password(password):
    """Validate password complexity"""
    if not password:
        return "Password is required"
    
    # Check length
    if len(password) < 12:
        return "Password must be at least 12 characters long"
    
    # Check for uppercase letter
    if not re.search(r'[A-Z]', password):
        return "Password must contain at least one uppercase letter"
    
    # Check for lowercase letter
    if not re.search(r'[a-z]', password):
        return "Password must contain at least one lowercase letter"
    
    # Check for digit
    if not re.search(r'\d', password):
        return "Password must contain at least one number"
    
    # Check for special character
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return "Password must contain at least one special character"
    
    return None

def validate_email_field(email):
    """Validate email format using email-validator library"""
    try:
        # Validate and get normalized form
        v = validate_email(email)
        return None  # Email is valid
    except EmailNotValidError as e:
        return "Please enter a valid email address"

@app.route('/register', methods=['POST'])
def register():
    # Get form data
    username = request.form.get('username', '').strip()
    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '')
    
    # Validate all fields
    errors = []
    
    # Validate username
    username_error = validate_username(username)
    if username_error:
        errors.append(username_error)
    
    # Validate email
    email_error = validate_email_field(email)
    if email_error:
        errors.append(email_error)
    
    # Validate password
    password_error = validate_password(password)
    if password_error:
        errors.append(password_error)
    
    # If there are validation errors, return them
    if errors:
        return jsonify({
            "error": "Validation failed",
            "details": errors
        }), 400
    
    # At this point, all validations passed - proceed with account creation
    # In a real application, you would hash the password and store user data
    # For demonstration purposes only:
    # hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    return jsonify({
        "message": "Registration successful",
        "username": username,
        "email": email
    }), 201

# Error handlers for better security
@app.errorhandler(400)
def bad_request(error):
    return jsonify({"error": "Invalid request"}), 400

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Server error"}), 500