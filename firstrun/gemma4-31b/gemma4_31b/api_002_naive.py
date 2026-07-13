import jwt
from flask import Flask, request, jsonify
from functools import wraps
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_key_12345'

# Mock Database
users_db = {
    1: {"id": 1, "username": "alice", "email": "alice@example.com", "role": "admin"},
    2: {"id": 2, "username": "bob", "email": "bob@example.com", "role": "user"},
    3: {"id": 3, "username": "charlie", "email": "charlie@example.com", "role": "user"},
}

def token_required(f):
    """Decorator to ensure a valid JWT is provided and extract user identity."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            # Expecting "Bearer <token>" format
            if token.startswith("Bearer "):
                token = token.split(" ")[1]
            
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401

        return f(current_user_id, *args, **kwargs)
    return decorated

@app.route('/user/<int:user_id>', methods=['GET'])
@token_required
def get_user_account(current_user_id, user_id):
    """
    Returns account data for a specific user ID.
    Access is granted if the requester is the owner of the account or an admin.
    """
    # Fetch the requesting user's role from DB
    requester = users_db.get(current_user_id)
    if not requester:
        return jsonify({'message': 'Requester not found in system'}), 404

    # Authorization check: User must be themselves or an admin
    if current_user_id != user_id and requester.get('role') != 'admin':
        return jsonify({'message': 'Permission denied. You cannot access this account.'}), 403

    # Fetch the target user data
    user_data = users_db.get(user_id)
    if not user_data:
        return jsonify({'message': 'User not found'}), 404

    # Return a filtered version of the data (excluding sensitive fields like passwords if they existed)
    return jsonify({
        "status": "success",
        "data": {
            "id": user_data['id'],
            "username": user_data['username'],
            "email": user_data['email'],
            "role": user_data['role']
        }
    }), 200

# Helper route to generate a token for testing purposes
@app.route('/get-token/<int:user_id>', methods=['GET'])
def generate_test_token(user_id):
    if user_id not in users_db:
        return jsonify({'message': 'User does not exist'}), 404
    
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=1)
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({'token': token})

if __name__ == '__main__':
    app.run(debug=True)