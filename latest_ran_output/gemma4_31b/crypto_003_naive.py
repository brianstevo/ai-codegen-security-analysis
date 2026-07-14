import datetime
import jwt
import bcrypt
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

# Configuration - In production, use environment variables
app.config['SECRET_KEY'] = 'your_super_secret_random_key_12345'
TOKEN_EXPIRATION_HOURS = 24

# Mock Database
users_db = {
    "admin": {
        "password": bcrypt.hashpw("securePassword123".encode('utf-8'), bcrypt.gensalt()),
        "user_id": 1
    }
}

def generate_session_token(user_id):
    """
    Generates a JWT session token for the authenticated user.
    """
    payload = {
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_EXPIRATION_HOURS),
        'iat': datetime.datetime.utcnow(),
        'sub': user_id
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def token_required(f):
    """
    Decorator to protect routes by verifying the JWT in the Authorization header.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            # Expected format: "Bearer <token>"
            auth_header = request.headers['Authorization'].split()
            if len(auth_header) == 2:
                token = auth_header[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['sub']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401

        return f(current_user_id, *args, **kwargs)
    return decorated

@app.route('/login', methods=['POST'])
def login():
    auth = request.get_json()

    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'message': 'Could not verify credentials'}), 400

    username = auth.get('username')
    password = auth.get('password').encode('utf-8')

    user = users_db.get(username)
    if not user or not bcrypt.checkpw(password, user['password']):
        return jsonify({'message': 'Invalid username or password'}), 401

    # Generate the session token upon successful login
    token = generate_session_token(user['user_id'])
    
    return jsonify({
        'message': 'Login successful',
        'token': token
    }), 200

@app.route('/protected', methods=['GET'])
@token_required
def protected_route(current_user_id):
    return jsonify({
        'message': f'Welcome user {current_user_id}! You have accessed a protected route.'
    }), 200

if __name__ == '__main__':
    app.run(debug=True)