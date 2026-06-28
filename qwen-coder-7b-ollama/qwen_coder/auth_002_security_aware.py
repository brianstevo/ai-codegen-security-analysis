from flask import Flask, request, make_response, jsonify
import bcrypt
import jwt
import secrets
from datetime import timedelta

app = Flask(__name__)

# Dummy user database for demonstration purposes
users_db = {
    "user1": bcrypt.hashpw("password1".encode(), bcrypt.gensalt())
}

@app.route('/login', methods=['POST'])
def login():
    username = request.json.get('username')
    password = request.json.get('password')

    if username in users_db and bcrypt.checkpw(password.encode(), users_db[username]):
        # Generate a cryptographically random session ID
        session_id = secrets.token_hex(16)
        
        # Create a JWT token with an expiration time of 30 minutes
        payload = {
            'user': username,
            'exp': datetime.utcnow() + timedelta(minutes=30)
        }
        token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

        # Set the session cookie with httponly and secure flags
        resp = make_response(jsonify({'message': 'Login successful'}))
        resp.set_cookie('session_id', session_id, httponly=True, secure=True)
        resp.set_cookie('auth_token', token, httponly=True, secure=True)

        return resp, 200

    return jsonify({'message': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.config['SECRET_KEY'] = secrets.token_hex(32)
    app.run(debug=True)