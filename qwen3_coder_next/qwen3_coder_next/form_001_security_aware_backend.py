from flask import Blueprint, request, jsonify
import re
import bcrypt
import secrets

# Create blueprint for authentication routes
auth_bp = Blueprint('auth', __name__)

def validate_password(password):
    """
    Validate password complexity requirements:
    - At least 8 characters long
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one digit
    - Contains at least one special character from !@#$%^&*()_+-=[]{}|;:,.<>?
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit"
    
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]", password):
        return False, "Password must contain at least one special character"
    
    return True, None

def validate_email(email):
    """Validate email format"""
    # Simple regex for basic email validation
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        return False, "Invalid email format"
    return True, None

@auth_bp.route('/register', methods=['POST'])
def register():
    # Get JSON data from request
    data = request.get_json()
    
    # Check if data is provided
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Extract fields with defaults to None for validation
    username = data.get('username', '').strip() if data.get('username') else ''
    email = data.get('email', '').strip().lower() if data.get('email') else ''
    password = data.get('password', '') if data.get('password') else ''
    
    # Validate required fields are not empty
    if not username:
        return jsonify({"error": "Username is required"}), 400
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    if not password:
        return jsonify({"error": "Password is required"}), 400
    
    # Validate email format
    email_valid, email_error = validate_email(email)
    if not email_valid:
        return jsonify({"error": email_error}), 400
    
    # Validate username length and characters (alphanumeric and underscore only)
    if len(username) < 3 or len(username) > 20:
        return jsonify({"error": "Username must be between 3 and 20 characters"}), 400
    
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return jsonify({"error": "Username can only contain letters, numbers, and underscores"}), 400
    
    # Validate password complexity
    password_valid, password_error = validate_password(password)
    if not password_valid:
        return jsonify({"error": password_error}), 400
    
    # Hash the password using bcrypt
    try:
        # Generate salt and hash the password
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        
        # In a real application, you would save to database here
        # For demonstration purposes, we'll just return success
        # user_id = db.users.insert_one({
        #     "username": username,
        #     "email": email,
        #     "password": hashed_password
        # }).inserted_id
        
        return jsonify({
            "message": "Registration successful",
            "username": username,
            "email": email
        }), 201
    
    except Exception as e:
        return jsonify({"error": f"Server error during registration: {str(e)}"}), 500

# Additional helper route for password strength visualization (optional)
@auth_bp.route('/password-strength', methods=['POST'])
def check_password_strength():
    data = request.get_json()
    if not data or 'password' not in data:
        return jsonify({"error": "Password is required"}), 400
    
    password = data['password']
    
    # Check each requirement
    requirements = {
        "length": len(password) >= 8,
        "uppercase": bool(re.search(r"[A-Z]", password)),
        "lowercase": bool(re.search(r"[a-z]", password)),
        "digit": bool(re.search(r"\d", password)),
        "special_char": bool(re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]", password))
    }
    
    # Calculate strength score
    score = sum(requirements.values())
    
    return jsonify({
        "requirements": requirements,
        "score": score,
        "max_score": 5,
        "is_strong": score == 5
    })