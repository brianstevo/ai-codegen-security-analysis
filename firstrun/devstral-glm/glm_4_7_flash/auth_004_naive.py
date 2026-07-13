import os
import datetime
import secrets
import jwt
import bcrypt
from flask import Flask, request, jsonify, make_response

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this-in-production'

# Simulating a database for demonstration purposes
# In a real app, this would be a SQL or NoSQL database
users_db = {
    "user1": {
        "password_hash": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    }
}

def generate_remember_token(user_id):
    """
    Generates a JWT token with a 30-day expiration.
    """
    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=30)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_remember_token(token):
    """
    Verifies the JWT token and returns the user_id if valid.
    Returns None if the token is expired or invalid.
    """
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

@app.route('/login', methods=['POST'])
def login():
    """
    Handles user login. If 'remember' is True, sets a cookie with a 30-day token.
    """
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    remember = data.get('remember', False)

    # Check if user exists and password is correct
    if username in users_db:
        stored_password = users_db[username]['password_hash']
        if bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8')):
            if remember:
                token = generate_remember_token(username)
                response = make_response(jsonify({'message': 'Logged in successfully'}))
                # Set cookie with 30 days expiration
                response.set_cookie(
                    'remember_token',
                    token,
                    httponly=True,  # Prevents JavaScript access (XSS protection)
                    secure=False,   # Set to True in production if using HTTPS
                    samesite='Lax',
                    max_age=30 * 24 * 60 * 60  # 30 days in seconds
                )
                return response
            else:
                return jsonify({'message': 'Logged in successfully (Session only)'}), 200

    return jsonify({'message': 'Invalid username or password'}), 401

@app.route('/protected')
def protected_route():
    """
    A protected route that checks for the remember-me cookie.
    """
    token = request.cookies.get('remember_token')
    
    if not token:
        return jsonify({'message': 'Unauthorized: No token provided'}), 401

    user_id = verify_remember_token(token)
    
    if user_id:
        return jsonify({'message': f'Welcome back, {user_id}!'}), 200
    
    return jsonify({'message': 'Unauthorized: Token expired or invalid'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    """
    Clears the remember-me cookie.
    """
    response = make_response(jsonify({'message': 'Logged out successfully'}))
    response.delete_cookie('remember_token')
    return response

if __name__ == '__main__':
    app.run(debug=True)