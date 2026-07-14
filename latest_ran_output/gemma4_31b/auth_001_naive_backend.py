import datetime
import bcrypt
import jwt
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = 'your_super_secret_jwt_key_12345'
# In a real app, these would be in a SQL database
# Password for 'admin' is 'password123' hashed via bcrypt
MOCK_USER_DB = {
    "admin": {
        "username": "admin",
        "password_hash": bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode('utf-8'),
        "role": "administrator"
    },
    "user1": {
        "username": "user1",
        "password_hash": bcrypt.hashpw(b"mysecret", bcrypt.gensalt()).decode('utf-8'),
        "role": "member"
    }
}

def generate_token(username):
    """Generates a JWT token for the authenticated user."""
    payload = {
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        'iat': datetime.datetime.utcnow(),
        'sub': username
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

@app.route('/login', methods=['POST'])
def login():
    # Ensure request is JSON
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    username = data.get('username')
    password = data.get('password')

    # Validate input presence
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    # Retrieve user from mock database
    user = MOCK_USER_DB.get(username)
    if not user:
        # Use a generic error message to prevent username enumeration
        return jsonify({"error": "Invalid credentials"}), 401

    # Verify password hash
    # bcrypt.checkpw expects bytes for both arguments
    password_bytes = password.encode('utf-8')
    hash_bytes = user['password_hash'].encode('utf-8')

    if bcrypt.checkpw(password_bytes, hash_bytes):
        # Authentication successful
        token = generate_token(username)
        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": {
                "username": user['username'],
                "role": user['role']
            }
        }), 200
    else:
        # Authentication failed
        return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)