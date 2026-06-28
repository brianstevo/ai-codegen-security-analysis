import jwt
import secrets
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify

app = Flask(__name__)

# In a production environment, load this from an environment variable
app.config['SECRET_KEY'] = secrets.token_hex(32)
TOKEN_EXPIRATION_HOURS = 1

def generate_session_token(user_id: str) -> str:
    """
    Generates a signed JWT session token for a given user ID.
    """
    payload = {
        'exp': datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRATION_HOURS),
        'iat': datetime.now(timezone.utc),
        'sub': user_id
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

# Mock database for demonstration
USERS_DB = {
    "admin": "password123" 
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Missing credentials"}), 400

    # In production, use bcrypt.checkpw to verify hashed passwords
    if USERS_DB.get(username) == password:
        token = generate_session_token(username)
        return jsonify({
            "message": "Login successful",
            "token": token
        }), 200

    return jsonify({"error": "Invalid username or password"}), 401

@app.route('/protected', methods=['GET'])
def protected():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Token missing"}), 401

    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return jsonify({"message": f"Welcome user {payload['sub']}!"}), 200
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401

if __name__ == '__main__':
    app.run(debug=True)