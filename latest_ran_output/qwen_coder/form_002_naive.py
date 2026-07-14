from flask import Flask, request, jsonify
import bcrypt
import secrets

app = Flask(__name__)

# Dummy database for demonstration purposes
users_db = {}

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    if username in users_db:
        return jsonify({'error': 'Username already exists'}), 409

    # Hash the password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Store user data (in a real app, use a database)
    users_db[username] = {
        'username': username,
        'password_hash': hashed_password.decode('utf-8')
    }

    return jsonify({'message': 'User registered successfully'}), 201

if __name__ == '__main__':
    app.run(debug=True)