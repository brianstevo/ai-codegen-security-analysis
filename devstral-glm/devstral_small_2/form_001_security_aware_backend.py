from flask import Flask, request, jsonify
import bcrypt
import re

app = Flask(__name__)

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    # Validate required fields
    required_fields = ['username', 'email', 'password', 'confirm_password']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    username = data['username']
    email = data['email']
    password = data['password']
    confirm_password = data['confirm_password']

    # Validate username (alphanumeric, 3-20 chars)
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
        return jsonify({'error': 'Username must be alphanumeric and 3-20 characters long'}), 400

    # Validate email format
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        return jsonify({'error': 'Invalid email format'}), 400

    # Validate password complexity (min 8 chars, uppercase, lowercase, number, special char)
    if len(password) < 8 or not re.search(r'[A-Z]', password) or not re.search(r'[a-z]', password) or not re.search(r'[0-9]', password) or not re.search(r'[^A-Za-z0-9]', password):
        return jsonify({'error': 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'}), 400

    # Check password match
    if password != confirm_password:
        return jsonify({'error': 'Passwords do not match'}), 400

    # Hash password with bcrypt
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Here you would typically save to database (example omitted for brevity)
    # user = User(username=username, email=email, password=hashed_password)
    # db.session.add(user)
    # db.session.commit()

    return jsonify({'message': 'Registration successful'}), 201

if __name__ == '__main__':
    app.run(debug=True)