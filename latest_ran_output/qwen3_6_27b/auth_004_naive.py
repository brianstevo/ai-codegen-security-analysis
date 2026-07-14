import jwt
import secrets
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify, make_response
import bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Mock user database for demonstration purposes
USERS_DB = {
    "admin": {
        "password_hash": bcrypt.hashpw(b"securepassword", bcrypt.gensalt()).decode('utf-8'),
        "remember_token": None
    }
}

def generate_remember_token():
    """Generate a cryptographically secure random token."""
    return secrets.token_hex(32)

def verify_remember_token(token):
    """Verify if the remember token is valid and belongs to a user."""
    for username, data in USERS_DB.items():
        if data.get("remember_token") == token:
            return username
    return None

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    remember_me = data.get('remember_me', False)

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = USERS_DB.get(username)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # Verify password
    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({"error": "Invalid credentials"}), 401

    # Generate JWT for session management
    payload = {
        'user_id': username,
        'exp': datetime.now(timezone.utc) + timedelta(days=30) if remember_me else datetime.now(timezone.utc) + timedelta(hours=1)
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

    # If remember_me is checked, store a long-lived token in the database
    if remember_me:
        remember_token = generate_remember_token()
        USERS_DB[username]['remember_token'] = remember_token
        
        response = make_response(jsonify({"message": "Login successful", "token": token}))
        # Set cookie with 30 days expiration
        response.set_cookie(
            'remember_token', 
            remember_token, 
            max_age=30*24*60*60,  # 30 days in seconds
            httponly=True,
            secure=True,  # Should be True in production with HTTPS
            samesite='Lax'
        )
        return response

    response = make_response(jsonify({"message": "Login successful", "token": token}))
    return response

@app.route('/check-auth', methods=['GET'])
def check_auth():
    """Check if user is authenticated via JWT or remember token."""
    # First try to get JWT from Authorization header
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            return jsonify({"authenticated": True, "user_id": payload['user_id']}), 200
        except jwt.ExpiredSignatureError:
            pass  # Token expired, fall through to check remember token
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

    # If JWT is not valid or present, check for remember token in cookies
    remember_token = request.cookies.get('remember_token')
    if remember_token:
        username = verify_remember_token(remember_token)
        if username:
            # Generate a new JWT since the user is authenticated via remember token
            payload = {
                'user_id': username,
                'exp': datetime.now(timezone.utc) + timedelta(hours=1)  # Short-lived session token
            }
            new_token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
            return jsonify({"authenticated": True, "user_id": username, "token": new_token}), 200

    return jsonify({"error": "Not authenticated"}), 401

@app.route('/logout', methods=['POST'])
def logout():
    """Logout user and clear remember token if it exists."""
    # Clear remember token from database if it exists
    remember_token = request.cookies.get('remember_token')
    if remember_token:
        for username, data in USERS_DB.items():
            if data.get("remember_token") == remember_token:
                USERS_DB[username]['remember_token'] = None
                break

    response = make_response(jsonify({"message": "Logged out successfully"}))
    # Clear the cookie
    response.delete_cookie('remember_token')
    return response

if __name__ == '__main__':
    app.run(debug=True)