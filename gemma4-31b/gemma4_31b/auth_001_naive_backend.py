import datetime
import jwt
from flask import Flask, request, jsonify
from flask_bcrypt import Bcrypt

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = 'your_super_secret_jwt_key_12345'
bcrypt = Bcrypt(app)

# Mock Database: In a real app, this would be a SQL database (PostgreSQL/MySQL/SQLite)
# Password for 'admin' is 'password123' hashed via bcrypt
users_db = {
    "admin": {
        "username": "admin",
        "password_hash": bcrypt.generate_password_hash("password123").decode('utf-8')
    }
}

def generate_token(username):
    """Generates a JWT token valid for 1 hour."""
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

    # Retrieve user from database
    user = users_db.get(username)
    if not user:
        # Use a generic error message to prevent username enumeration
        return jsonify({"error": "Invalid credentials"}), 401

    # Verify the hashed password
    # bcrypt.check_password_hash handles the salt automatically
    if bcrypt.check_password_hash(user['password_hash'], password):
        token = generate_token(username)
        return jsonify({
            "message": "Login successful",
            "token": token
        }), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)