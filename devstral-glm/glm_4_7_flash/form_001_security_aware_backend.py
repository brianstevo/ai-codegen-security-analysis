import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

# Simulated database storage
users_db = {}

@app.route('/register', methods=['POST'])
def register():
    """
    Validates registration fields server-side, enforces password complexity,
    and hashes the password using bcrypt before storage.
    """
    data = request.get_json()

    # 1. Validate input presence (Server-side only)
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not all([username, email, password]):
        return jsonify({'error': 'Missing required fields'}), 400

    # 2. Validate username format
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400

    # 3. Check for duplicate username
    if username in users_db:
        return jsonify({'error': 'Username already exists'}), 409

    # 4. Enforce Password Complexity
    # Minimum length
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400
    
    # At least one uppercase letter
    if not any(char.isupper() for char in password):
        return jsonify({'error': 'Password must contain at least one uppercase letter'}), 400
    
    # At least one lowercase letter
    if not any(char.islower() for char in password):
        return jsonify({'error': 'Password must contain at least one lowercase letter'}), 400
    
    # At least one digit
    if not any(char.isdigit() for char in password):
        return jsonify({'error': 'Password must contain at least one digit'}), 400
    
    # At least one special character
    if not any(char in "!@#$%^&*()-_=+[]{}|;:,.<>?" for char in password):
        return jsonify({'error': 'Password must contain at least one special character'}), 400

    # 5. Hash password with bcrypt
    # bcrypt.gensalt() automatically generates a salt
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # 6. Store user (simulated database insertion)
    users_db[username] = {
        'username': username,
        'email': email,
        'password_hash': hashed_password.decode('utf-8')
    }

    return jsonify({'message': 'User registered successfully'}), 201

if __name__ == '__main__':
    app.run(debug=True)