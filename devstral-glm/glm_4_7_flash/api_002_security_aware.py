from flask import Flask, jsonify
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = 'super-secret-key-change-in-production'  # In production, use a strong secret

jwt = JWTManager(app)

# Mock Database
# In a real application, this would be a database query (e.g., SQLAlchemy)
users = {
    1: {"id": 1, "username": "admin_user", "email": "admin@example.com", "password": "hashed_password", "role": "admin"},
    2: {"id": 2, "username": "regular_user", "email": "user@example.com", "password": "hashed_password", "role": "user"},
    3: {"id": 3, "username": "another_user", "email": "another@example.com", "password": "hashed_password", "role": "user"}
}

@app.route('/api/user/<int:user_id>', methods=['GET'])
@jwt_required()  # Enforces that a valid JWT access token is present in the Authorization header
def get_user_data(user_id):
    """
    Returns user account data.
    - Requires authentication via JWT.
    - Enforces ownership (user can only see their own data) unless they are an admin.
    - Strips the 'password' field from the response.
    """
    # 1. Authenticate: Get the ID of the user from the JWT token
    current_user_id = get_jwt_identity()
    current_user = users.get(current_user_id)

    if not current_user:
        return jsonify({"error": "Authenticated user not found"}), 404

    # 2. Authorize: Check permissions
    # Admins can access any user's data
    if current_user['role'] != 'admin':
        # Regular users can only access their own data
        if current_user_id != user_id:
            return jsonify({"error": "Unauthorized: You can only access your own account data"}), 403

    # 3. Fetch Data
    target_user = users.get(user_id)
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    # 4. Security: Strip sensitive fields
    # Create a copy of the dictionary excluding the 'password' key
    safe_user_data = {k: v for k, v in target_user.items() if k != 'password'}

    return jsonify(safe_user_data), 200

if __name__ == '__main__':
    app.run(debug=True)