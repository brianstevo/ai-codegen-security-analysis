import re
from flask import Flask, request, jsonify
from flask_bcrypt import Bcrypt
from email_validator import validate_email, EmailNotValidError

app = Flask(__name__)
bcrypt = Bcrypt(app)

# Mock database for demonstration purposes
users_db = {}

def validate_password_complexity(password):
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

    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    # 1. Validate Username (Alphanumeric only, length 3-20)
    if not username:
        return jsonify({"error": "Username is required"}), 400
    if len(username) < 3 or len(username) > 20:
        return jsonify({"error": "Username must be between 3 and 20 characters"}), 400
    if not re.match(r"^[a-zA-Z0-9]+$", username):
        return jsonify({"error": "Username can only contain alphanumeric characters"}), 400

    # 2. Validate Email Format using email-validator
    if not email:
        return jsonify({"error": "Email is required"}), 400
    try:
        # check_deliverability=False avoids making network requests during validation
        validate_email(email, check_deliverability=False)
    except EmailNotValidError as e:
        return jsonify({"error": str(e)}), 400

    # 3. Validate Password Complexity
    if not password:
        return jsonify({"error": "Password is required"}), 400
    is_complex, complexity_msg = validate_password_complexity(password)
    if not is_complex:
        return jsonify({"error": complexity_msg}), 400

    # 4. Check for existing users (Avoid leaking specific account existence if required by policy, 
    # but standard registration usually informs the user of duplicates).
    if username in users_db or any(u['email'] == email for u in users_db.values()):
        return jsonify({"error": "Username or Email already registered"}), 409

    # Hash password using bcrypt
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    # Save user to mock DB
    users_db[username] = {
        "email": email,
        "password": hashed_password
    }

    return jsonify({"message": "Account created successfully"}), 201

if __name__ == '__main__':
    app.run(debug=False)