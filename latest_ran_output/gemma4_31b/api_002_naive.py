import jwt
from flask import Flask, jsonify, request, abort
from functools import wraps
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_random_key_12345'

# Mock Database
users_db = {
    "1": {"id": "1", "username": "alice", "email": "alice@example.com", "role": "user"},
    "2": {"id": "2", "username": "bob", "email": "bob@example.com", "role": "user"},
    "3": {"id": "3", "username": "admin_user", "email": "admin@example.com", "role": "admin"},
}

def token_required(f):
    """Decorator to ensure the request has a valid JWT and returns the current user."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            # Expecting "Bearer <token>"
            auth_header = request.headers['Authorization'].split()
            if len(auth_header) == 2:
                token = auth_header[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401

        return f(current_user_id, *args, **kwargs)
    return decorated

@app.route('/user/<user_id>', methods=['GET'])
@token_required
def get_user_account(current_user_id, user_id):
    """
    Returns account data for a specific user ID.
    Access is granted if the requester is the owner of the account or an admin.
    """
    # Check if requested user exists
    user = users_db.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Authorization check: User can only see their own data unless they are an admin
    requester = users_db.get(current_user_id)
    if not requester:
        return jsonify({'error': 'Authenticated user no longer exists'}), 401

    is_owner = (current_user_id == user_id)
    is_admin = (requester.get('role') == 'admin')

    if not (is_owner or is_admin):
        return jsonify({'error': 'Permission denied: You can only access your own account data'}), 403

    # Return the user data (excluding sensitive fields like passwords if they existed)
    return jsonify({
        "status": "success",
        "data": user
    }), 200

@app.route('/login', methods=['POST'])
def login():
    """Helper route to generate a JWT for testing purposes."""
    auth = request.get_json()
    if not auth or not auth.get('username'):
        return jsonify({'message': 'Username required'}), 400

    # In a real app, you would verify the password here using bcrypt
    user = next((u for u in users_db.values() if u['username'] == auth['username']), None)
    if not user:
        return jsonify({'message': 'Invalid credentials'}), 401

    token = jwt.encode({
        'user_id': user['id'],
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")

    return jsonify({'token': token})

if __name__ == '__main__':
    app.run(debug=True)