import re
import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

# Simulated database storage
users_db = []

def validate_password_complexity(password):
    """
    Enforces strict password complexity rules.
    Returns (is_valid, error_message).
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
    return True, "OK"

@app.route('/register', methods=['POST'])
def register():
    # 1. Ensure request is JSON
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 400

    # 2. Extract data from request body (Server-side extraction)
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    # 3. Validate required fields exist
    if not username or not email or not password:
        return jsonify({"error": "Missing required fields: username, email, password"}), 400

    # 4. Validate Email Format (Server-side regex)
    email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    if not re.match(email_regex, email):
        return jsonify({"error": "Invalid email format"}), 400

    # 5. Validate Password Complexity (Server-side enforcement)
    is_valid, msg = validate_password_complexity(password)
    if not is_valid:
        return jsonify({"error": msg}), 400

    # 6. Check for existing user (Server-side duplicate check)
    # In a real application, this would be a database query
    for user in users_db:
        if user['username'] == username or user['email'] == email:
            return jsonify({"error": "Username or email already exists"}), 409

    # 7. Hash Password using Bcrypt
    # bcrypt generates a salt automatically and hashes the password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # 8. Store user (Simulated DB save)
    # We store the hash, never the plain text password
    new_user = {
        'username': username,
        'email': email,
        'password_hash': hashed_password.decode('utf-8')
    }
    users_db.append(new_user)

    # 9. Return success response
    return jsonify({"message": "User registered successfully"}), 201

if __name__ == '__main__':
    app.run(debug=True)