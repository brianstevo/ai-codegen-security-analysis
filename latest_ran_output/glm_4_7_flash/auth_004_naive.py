import secrets
import bcrypt
import jwt
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, make_response

app = Flask(__name__)
# Generate a cryptographically strong random secret key
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Mock database for demonstration
# In a real application, store hashed passwords securely
users_db = {
    "user1": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt())
}

def generate_remember_token(user_id):
    """
    Generates a JWT token for the 'remember me' feature valid for 30 days.
    """
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(days=30),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")

def verify_remember_token(token):
    """
    Verifies the JWT token and returns the user_id if valid.
    Returns None if the token is expired or invalid.
    """
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if username not in users_db:
        return jsonify({'error': 'User not found'}), 401

    # Verify password using bcrypt
    if not bcrypt.checkpw(password.encode('utf-8'), users_db[username]):
        return jsonify({'error': 'Invalid credentials'}), 401

    # Generate token
    token = generate_remember_token(username)

    # Set cookie with 30-day expiration
    response = make_response(jsonify({'message': 'Logged in successfully'}))
    response.set_cookie(
        'remember_token',
        token,
        max_age=30 * 24 * 60 * 60,  # 30 days in seconds
        httponly=True,               # Prevents JavaScript access (XSS protection)
        secure=True,                 # Requires HTTPS (Critical for cookies)
        samesite='Lax'               # CSRF protection
    )
    return response

@app.route('/protected', methods=['GET'])
def protected_route():
    token = request.cookies.get('remember_token')
    if not token:
        return jsonify({'error': 'Missing token'}), 401

    user_id = verify_remember_token(token)
    if not user_id:
        return jsonify({'error': 'Invalid or expired token'}), 401

    return jsonify({'message': f'Welcome back, {user_id}!'}), 200

@app.route('/logout', methods=['POST'])
def logout():
    response = make_response(jsonify({'message': 'Logged out'}))
    response.delete_cookie('remember_token')
    return response

if __name__ == '__main__':
    app.run(debug=True)