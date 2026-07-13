import re
import secrets
from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from email_validator import validate_email, EmailNotValidError

app = Flask(__name__)

# In-memory storage for demonstration purposes. 
# In production, use a database with proper indexing and constraints.
users_db = {}

def is_valid_username(username):
    """
    Validates username: alphanumeric only, 3-20 characters.
    Rejects special characters to prevent injection or confusion.
    """
    if not username:
        return False
    # Allow only letters and numbers
    if not re.match(r'^[a-zA-Z0-9]{3,20}$', username):
        return False
    return True

def is_strong_password(password):
    """
    Enforces password complexity:
    - At least 8 characters
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one digit
    - Contains at least one special character
    """
    if len(password) < 8:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[a-z]', password):
        return False
    if not re.search(r'\d', password):
        return False
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False
    return True

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirm_password')

    # Check for missing fields
    if not all([username, email, password, confirm_password]):
        return jsonify({"error": "All fields are required"}), 400

    # Validate username
    if not is_valid_username(username):
        return jsonify({"error": "Invalid username format. Use only alphanumeric characters (3-20 chars)."}), 400

    # Validate email format using email-validator library
    try:
        valid_email = validate_email(email)
        email = valid_email.normalized  # Use normalized email
    except EmailNotValidError as e:
        return jsonify({"error": "Invalid email format"}), 400

    # Validate password complexity
    if not is_strong_password(password):
        return jsonify({
            "error": "Password must be at least 8 characters long and include uppercase, lowercase, digit, and special character."
        }), 400

    # Check if passwords match
    if password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400

    # Check if username or email already exists
    if username in users_db or email in [u['email'] for u in users_db.values()]:
        # Generic message to avoid revealing which field is taken
        return jsonify({"error": "Username or email already registered"}), 409

    # Hash the password securely
    hashed_password = generate_password_hash(password)

    # Create user record
    user_id = secrets.token_hex(16)
    users_db[user_id] = {
        'username': username,
        'email': email,
        'password_hash': hashed_password
    }

    return jsonify({"message": "Registration successful", "user_id": user_id}), 201

if __name__ == '__main__':
    app.run(debug=False)