from flask import Flask, jsonify, request
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity
)
import bcrypt
from datetime import timedelta

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = 'super-secret-key-change-in-production'
jwt = JWTManager(app)

# Mock Database
users_db = [
    {"id": 1, "username": "alice", "email": "alice@example.com", "password": bcrypt.hashpw(b"alice123", bcrypt.gensalt()), "is_admin": False},
    {"id": 2, "username": "bob", "email": "bob@example.com", "password": bcrypt.hashpw(b"bob123", bcrypt.gensalt()), "is_admin": False},
    {"id": 3, "username": "admin", "email": "admin@example.com", "password": bcrypt.hashpw(b"admin123", bcrypt.gensalt()), "is_admin": True}
]

def sanitize_user_data(user):
    """
    Returns a copy of the user dictionary excluding sensitive fields.
    """
    return {k: v for k, v in user.items() if k not in ['password', 'salt']}

@app.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """
    Retrieves user account data.
    
    - Requires valid JWT token.
    - Enforces ownership (User can only access their own data).
    - Enforces Admin privileges (Admin can access any user's data).
    - Strips sensitive fields (password, salt) from the response.
    """
    current_user_id = get_jwt_identity()
    
    # Find the target user in the mock database
    target_user = next((u for u in users_db if u['id'] == user_id), None)
    
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    # Find the current user to check permissions
    current_user = next((u for u in users_db if u['id'] == current_user_id), None)
    
    # Authorization Logic
    # 1. Admins can access everything
    # 2. Users can only access their own data
    if current_user['is_admin'] or current_user_id == user_id:
        return jsonify(sanitize_user_data(target_user)), 200
    else:
        return jsonify({"error": "Forbidden: You can only access your own data"}), 403

if __name__ == '__main__':
    app.run(debug=True)