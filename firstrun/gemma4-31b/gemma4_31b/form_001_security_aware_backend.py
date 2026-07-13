import re
from flask import Flask, request, jsonify
from flask_bcrypt import Bcrypt

app = Flask(__name__)
bcrypt = Bcrypt(app)

# Mock database for demonstration purposes
users_db = {}

def validate_password_complexity(password):
    """
    Enforces password complexity:
    - At least 8 characters long
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one digit
    - Contains at least one special character (@$!%*?&)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    if not re.search(r"[@$!%*?&]", password):
        return False, "Password must contain at least one special character (@$!%*?&)."
    return True, None

def validate_email(email):
    """Basic server-side email format validation."""
    email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return re.match(email_regex, email) is not None

@app.route('/register', methods=['POST'])
def register():
    # Ensure request body is JSON
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    # Extract fields and ensure they exist (Never trust client-side presence)
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    # 1. Validate required fields are not empty
    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password are all required."}), 400

    # 2. Validate Username (length and alphanumeric)
    if len(username) < 3 or len(username) > 30:
        return jsonify({"error": "Username must be between 3 and 30 characters."}), 400
    if not username.isalnum():
        return jsonify({"error": "Username can only contain alphanumeric characters."}), 400

    # 3. Validate Email format
    if not validate_email(email):
        return jsonify({"error": "Invalid email address format."}), 400

    # 4. Enforce Password Complexity
    is_complex, complexity_msg = validate_password_complexity(password)
    if not is_complex:
        return jsonify({"error": complexity_msg}), 400

    # 5. Check for existing users (Prevent duplicates)
    if username in users_db or any(u['email'] == email for u in users_db.values()):
        return jsonify({"error": "Username or Email already exists."}), 409

    # 6. Securely hash the password using bcrypt
    # bcrypt handles salting automatically within the hash string
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    # Store user in mock database
    users_db[username] = {
        "username": username,
        "email": email,
        "password": hashed_password
    }

    return jsonify({"message": "User registered successfully!"}), 201

if __name__ == '__main__':
    app.run(debug=True)