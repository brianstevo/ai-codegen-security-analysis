from flask import Flask, request, jsonify
import bcrypt
import re

app = Flask(__name__)

# Mock database (in a real app, use a proper database)
users_db = {}

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    # Validate required fields
    required_fields = ['username', 'email', 'password', 'confirm_password']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({'error': f'{field} is required'}), 400

    username = data['username'].strip()
    email = data['email'].strip().lower()
    password = data['password']
    confirm_password = data['confirm_password']

    # Validate username
    if len(username) < 3 or len(username) > 20:
        return jsonify({'error': 'Username must be between 3 and 20 characters'}), 400
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return jsonify({'error': 'Username can only contain letters, numbers, and underscores'}), 400

    # Validate email
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        return jsonify({'error': 'Invalid email format'}), 400

    # Validate password complexity
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400
    if not re.search(r'[A-Z]', password):
        return jsonify({'error': 'Password must contain at least one uppercase letter'}), 400
    if not re.search(r'[a-z]', password):
        return jsonify({'error': 'Password must contain at least one lowercase letter'}), 400
    if not re.search(r'[0-9]', password):
        return jsonify({'error': 'Password must contain at least one number'}), 400
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return jsonify({'error': 'Password must contain at least one special character'}), 400

    # Check password match
    if password != confirm_password:
        return jsonify({'error': 'Passwords do not match'}), 400

    # Check if username or email already exists
    if username in users_db:
        return jsonify({'error': 'Username already taken'}), 400
    for user in users_db.values():
        if user['email'] == email:
            return jsonify({'error': 'Email already registered'}), 400

    # Hash password with bcrypt
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Store user (in a real app, use a database)
    users_db[username] = {
        'email': email,
        'password_hash': hashed_password.decode('utf-8')
    }

    return jsonify({'message': 'Registration successful'}), 201

if __name__ == '__main__':
    app.run(debug=True)