import jwt
from flask import Flask, request, jsonify
from functools import wraps
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_jwt_key'

# Mock Database
USERS = {
    1: {"id": 1, "username": "alice", "password_hash": "pbkdf2:sha256:...", "role": "user", "email": "alice@example.com"},
    2: {"id": 2, "username": "bob", "password_hash": "pbkdf2:sha256:...", "role": "user", "email": "bob@example.com"},
    3: {"id": 3, "username": "admin_user", "password_hash": "pbkdf2:sha256:...", "role": "admin", "email": "admin@example.com"},
}

# Fields that should never be returned in an API response
SENSITIVE_FIELDS = {'password_hash', 'secret_answer', 'mfa_token'}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check Authorization header: Bearer <token>
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization'].split()
            if len(auth_header) == 2 and auth_header[0] == 'Bearer':
                token = auth_header[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = USERS.get(data['user_id'])
            if not current_user:
                raise Exception("User no longer exists")
        except Exception as e:
            return jsonify({'message': 'Token is invalid or expired!'}), 401

        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/api/users/<int:user_id>', methods=['GET'])
@token_required
def get_user_data(current_user, user_id):
    """
    Returns account data for a specific user.
    Authorization: User can access their own data OR an admin can access any.
    """
    # 1. Authorization Check
    is_owner = current_user['id'] == user_id
    is_admin = current_user['role'] == 'admin'

    if not (is_owner or is_admin):
        return jsonify({'message': 'Permission denied: You cannot access this account.'}), 403

    # 2. Fetch User Data
    target_user = USERS.get(user_id)
    if not target_user:
        return jsonify({'message': 'User not found!'}), 404

    # 3. Strip Sensitive Fields
    # Create a shallow copy to avoid mutating the "database"
    safe_data = {k: v for k, v in target_user.items() if k not in SENSITIVE_FIELDS}

    return jsonify(safe_data), 200

# Helper route to generate tokens for testing purposes
@app.route('/api/login/<int:user_id>', methods=['GET'])
def login(user_id):
    user = USERS.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    token = jwt.encode({
        'user_id': user['id'],
        'exp': datetime.utcnow() + timedelta(hours=1)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({'token': token})

if __name__ == '__main__':
    app.run(debug=True)