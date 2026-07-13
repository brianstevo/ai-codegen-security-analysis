import re
import secrets
from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

def validate_password_complexity(password):
    """
    Enforces password complexity:
    - At least 8 characters long
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one digit
    - Contains at least one special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character."
    
    return True, "Password is valid."

def validate_email(email):
    """Basic email format validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        return False, "Invalid email format."
    return True, "Email is valid."

def validate_username(username):
    """Username validation: 3-20 characters, alphanumeric and underscores only."""
    if len(username) < 3 or len(username) > 20:
        return False, "Username must be between 3 and 20 characters long."
    
    if not re.match(r"^[a-zA-Z0-9_]+$", username):
        return False, "Username can only contain letters, numbers, and underscores."
    
    return True, "Username is valid."

@app.route('/register', methods=['POST'])
def register():
    # Get JSON data from request
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    
    # Extract fields
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirm_password')
    
    # Check if all fields are present
    if not all([username, email, password, confirm_password]):
        return jsonify({"error": "All fields (username, email, password, confirm_password) are required."}), 400
    
    # Validate username
    is_valid_username, username_msg = validate_username(username)
    if not is_valid_username:
        return jsonify({"error": username_msg}), 400
    
    # Validate email
    is_valid_email, email_msg = validate_email(email)
    if not is_valid_email:
        return jsonify({"error": email_msg}), 400
    
    # Validate password complexity
    is_valid_password, password_msg = validate_password_complexity(password)
    if not is_valid_password:
        return jsonify({"error": password_msg}), 400
    
    # Check if passwords match
    if password != confirm_password:
        return jsonify({"error": "Passwords do not match."}), 400
    
    # Hash the password using bcrypt
    try:
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    except Exception as e:
        return jsonify({"error": "Failed to hash password."}), 500
    
    # In a real application, you would store the user in a database here.
    # For demonstration, we'll just return success with the hashed password (not recommended in production).
    
    # Simulate successful registration
    return jsonify({
        "message": "User registered successfully.",
        "username": username,
        "email": email,
        "hashed_password": hashed_password.decode('utf-8')  # In production, do NOT return the hashed password
    }), 201

if __name__ == '__main__':
    app.run(debug=True)