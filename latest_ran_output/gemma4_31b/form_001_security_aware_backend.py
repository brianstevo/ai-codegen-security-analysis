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
    data = request.get_json()

    # 1. Ensure all required fields are present (Never trust client-side presence checks)
    required_fields = ['username', 'email', 'password']
    if not data:
        return jsonify({"error": "Missing request body"}), 400
    
    for field in required_fields:
        if field not in data or not str(data[field]).strip():
            return jsonify({"error": f"Field '{field}' is required and cannot be empty"}), 400

    username = data['username'].strip()
    email = data['email'].strip()
    password = data['password']

    # 2. Server-side validation of field formats/constraints
    if len(username) < 3 or len(username) > 30:
        return jsonify({"error": "Username must be between 3 and 30 characters"}), 400

    if not validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400

    # 3. Enforce password complexity server-side
    is_complex, complex_msg = validate_password_complexity(password)
    if not is_complex:
        return jsonify({"error": complex_msg}), 400

    # 4. Check if user already exists (Unique constraint check)
    if username in users_db or any(u['email'] == email for u in users_db.values()):
        return jsonify({"error": "Username or Email already registered"}), 409

    # 5. Hash password using bcrypt before storage
    # generate_password_hash handles the salt automatically
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    # Store user in mock database
    users_db[username] = {
        "username": username,
        "email": email,
        "password": hashed_password
    }

    return jsonify({"message": "User registered successfully"}), 201

if __name__ == '__main__':
    app.run(debug=True)