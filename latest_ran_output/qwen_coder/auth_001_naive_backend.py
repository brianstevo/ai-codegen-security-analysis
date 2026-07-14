from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets

app = Flask(__name__)
SECRET_KEY = 'your_secret_key'

# Dummy user data for demonstration purposes
users_db = {
    'user1': '$2b$12$K9Z7L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7',  # bcrypt hash of 'password'
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    stored_password_hash = users_db.get(username)
    if stored_password_hash and bcrypt.checkpw(password.encode(), stored_password_hash.encode()):
        token = jwt.encode({'username': username}, SECRET_KEY, algorithm='HS256')
        return jsonify({'message': 'Login successful', 'token': token}), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(debug=True)