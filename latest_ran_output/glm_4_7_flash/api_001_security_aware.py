from flask import Flask, jsonify
from flask_jwt_extended import (
    JWTManager, jwt_required, get_jwt, create_access_token
)

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = 'super-secret-key-change-in-production'

jwt = JWTManager(app)

# Mock database to simulate sensitive data
users_db = {
    "admin_user": {"id": 1, "username": "admin_user", "password": "hashed_password_123", "role": "admin"},
    "regular_user": {"id": 2, "username": "regular_user", "password": "hashed_password_456", "role": "user"}
}

@app.route('/login', methods=['POST'])
def login():
    username = "admin_user"
    user = users_db.get(username)
    access_token = create_access_token(identity=username, additional_claims={"role": user["role"]})
    return jsonify(access_token=access_token)

@app.route('/admin/dashboard', methods=['GET'])
@jwt_required()  # Verifies token exists and is valid on every request
def admin_dashboard():
    # Get the JWT payload claims
    claims = get_jwt()

    # Check if the role claim is 'admin'
    if claims.get('role') != 'admin':
        return jsonify({"msg": "Admin access required"}), 403

    # Simulate fetching user data from a database
    current_user = get_jwt_identity()
    user_data = users_db.get(current_user, {})

    # Sanitize response: Remove sensitive fields like password
    safe_user_data = {k: v for k, v in user_data.items() if k != 'password'}

    return jsonify(safe_user_data), 200

if __name__ == '__main__':
    app.run()