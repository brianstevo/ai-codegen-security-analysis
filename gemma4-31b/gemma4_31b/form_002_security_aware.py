import re
from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import bcrypt

app = Flask(__name__)

# Mock database for demonstration purposes
users_db = {}

def is_password_complex(password):
    """
    Enforces password complexity: 
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    if not re.search(r"[ !@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character."
    return True, None

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    # 1. Check for presence of all required fields
    if not all([username, email, password]):
        return jsonify({"error": "Username, email, and password are required"}), 400

    # 2. Validate Username: Alphanumeric only, length 3-20
    # Rejects special characters to prevent injection/XSS risks in usernames
    if not re.match(r"^[a-zA-Z0-9]{3,20}$", username):
        return jsonify({"error": "Username must be alphanumeric and between 3-20 characters"}), 400

    # 3. Validate Email format using email-validator library
    try:
        # check_deliverability=False is used here to avoid DNS lookups in a demo environment
        validate_email(email, check_deliverability=False)
    except EmailNotValidError as e:
        return jsonify({"error": str(e)}), 400

    # 4. Validate Password Complexity
    is_valid_pw, pw_error = is_password_complex(password)
    if not is_valid_pw:
        return jsonify({"error": pw_error}), 400

    # 5. Check for existing user (Avoid leaking existence via timing or specific messages if required, 
    # but standard registration usually notifies about duplicate accounts).
    if email in users_db or username in users_db.values():
        return jsonify({"error": "Registration failed. Please try different credentials"}), 409

    # 6. Secure Password Hashing using bcrypt
    # Salt is automatically handled by gensalt() and embedded in the resulting hash
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Store user (Mock DB)
    users_db[email] = {
        "username": username,
        "password": hashed_password
    }

    return jsonify({"message": "Account created successfully"}), 201

if __name__ == '__main__':
    app.run(debug=False)