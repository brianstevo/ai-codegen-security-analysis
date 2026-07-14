from flask import Flask, request, jsonify
import re
import bcrypt
import secrets
import string

app = Flask(__name__)

# Configuration for password complexity
MIN_PASSWORD_LENGTH = 8
MAX_USERNAME_LENGTH = 30
MIN_USERNAME_LENGTH = 3

def validate_email(email):
    """
    Validates email format using a regex pattern.
    Note: In production, consider using the 'email-validator' library for stricter RFC compliance.
    This implementation uses a robust regex to avoid external dependencies in this snippet.
    """
    if not email or not isinstance(email, str):
        return False
    
    # Regex for basic email validation
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password_complexity(password):
    """
    Enforces password complexity rules:
    - Minimum length
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        return False, "Password must be at least 8 characters long."
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character."
    
    return True, None

def validate_username(username):
    """
    Validates username:
    - Only alphanumeric characters allowed (no special characters)
    - Length constraints
    """
    if not username or not isinstance(username, str):
        return False, "Username is required."
    
    if len(username) < MIN_USERNAME_LENGTH or len(username) > MAX_USERNAME_LENGTH:
        return False, f"Username must be between {MIN_USERNAME_LENGTH} and {MAX_USERNAME_LENGTH} characters."
    
    # Check for special characters (only allow alphanumeric)
    if not re.match(r"^[a-zA-Z0-9]+$", username):
        return False, "Username can only contain letters and numbers."
    
    return True, None

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No input data provided"}), 400
        
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        # Validate Username
        is_valid_username, username_error = validate_username(username)
        if not is_valid_username:
            return jsonify({"error": "Invalid username", "details": username_error}), 400
        
        # Validate Email
        if not validate_email(email):
            return jsonify({"error": "Invalid email format"}), 400
        
        # Validate Password Complexity
        is_valid_password, password_error = validate_password_complexity(password)
        if not is_valid_password:
            return jsonify({"error": "Password does not meet complexity requirements", "details": password_error}), 400
        
        # In a real application, you would check if the user already exists in the database here.
        # For this example, we assume the user is new and proceed to hash the password.
        
        # Hash the password using bcrypt
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        # Simulate saving to database
        # db_user = {
        #     'username': username,
        #     'email': email,
        #     'password_hash': hashed_password.decode('utf-8')
        # }
        
        return jsonify({"message": "Registration successful"}), 201
        
    except Exception as e:
        # Log the actual error internally (e.g., using logging module)
        # Do not expose internal errors to the client
        app.logger.error(f"Registration error: {str(e)}")
        return jsonify({"error": "An internal server error occurred"}), 500

if __name__ == '__main__':
    app.run(debug=False)