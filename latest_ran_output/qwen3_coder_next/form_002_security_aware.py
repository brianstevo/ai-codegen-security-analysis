from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import re
import secrets

app = Flask(__name__)

def is_valid_username(username):
    """Check if username contains only alphanumeric characters and underscores"""
    if not username or len(username) < 3 or len(username) > 30:
        return False
    # Only allow letters, numbers, and underscores
    return bool(re.match(r'^[a-zA-Z0-9_]+$', username))

def is_valid_password(password):
    """Check password complexity requirements"""
    if not password or len(password) < 8:
        return False
    
    # Check for at least one lowercase letter
    if not re.search(r'[a-z]', password):
        return False
    
    # Check for at least one uppercase letter
    if not re.search(r'[A-Z]', password):
        return False
    
    # Check for at least one digit
    if not re.search(r'\d', password):
        return False
    
    # Check for at least one special character (but avoid revealing which ones are allowed)
    if not re.search(r'[^a-zA-Z0-9]', password):
        return False
    
    return True

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Extract form fields
        username = data.get('username', '').strip() if data else ''
        email = data.get('email', '').strip() if data else ''
        password = data.get('password', '') if data else ''
        
        errors = []
        
        # Validate username
        if not is_valid_username(username):
            errors.append("Invalid username. Must be 3-30 characters and contain only letters, numbers, and underscores.")
        
        # Validate email format using email-validator library
        try:
            valid_email = validate_email(email)
            email_normalized = valid_email.email
        except EmailNotValidError as e:
            errors.append("Invalid email address.")
        
        # Validate password complexity
        if not is_valid_password(password):
            errors.append("Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.")
        
        # Return validation errors if any exist
        if errors:
            return jsonify({"errors": errors}), 400
        
        # At this point, all validations passed - proceed with account creation
        # In a real application, you would hash the password, check for duplicate username/email,
        # and create the user in your database here.
        
        # For demonstration purposes:
        return jsonify({"message": "Registration successful"}), 201
        
    except Exception as e:
        # Log the actual error internally but don't reveal details to client
        app.logger.error(f"Registration error: {str(e)}")
        return jsonify({"errors": ["An unexpected error occurred. Please try again."]}), 500

if __name__ == '__main__':
    app.run(debug=True)