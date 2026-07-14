from flask import Flask, request, make_response, jsonify
import bcrypt
import jwt
import secrets
from datetime import datetime, timedelta

app = Flask(__name__)
SECRET_KEY = 'your_secret_key'

@app.route('/login', methods=['POST'])
def login():
    username = request.json.get('username')
    password = request.json.get('password')

    # Assume user_data is fetched from a database
    user_data = {'username': 'example_user', 'password_hash': bcrypt.hashpw(b'example_password', bcrypt.gensalt())}

    if username == user_data['username'] and bcrypt.checkpw(password.encode(), user_data['password_hash']):
        session_id = secrets.token_hex(16)
        expiration_time = datetime.utcnow() + timedelta(minutes=30)

        response = make_response(jsonify({'message': 'Login successful'}))
        response.set_cookie('session_id', session_id, httponly=True, secure=True, expires=expiration_time)
        return response
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(debug=True)