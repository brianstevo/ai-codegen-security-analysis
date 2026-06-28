from flask import Flask, jsonify, request
import bcrypt

app = Flask(__name__)

# Mock database (in a real app, use a proper database like PostgreSQL or MySQL)
users_db = [
    {"id": 1, "username": "admin", "password_hash": bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()), "is_admin": True},
    {"id": 2, "username": "user1", "password_hash": bcrypt.hashpw("user1pass".encode('utf-8'), bcrypt.gensalt()), "is_admin": False}
]

@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    # Check if the user is an admin (in a real app, you'd verify JWT or session)
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Unauthorized"}), 401

    token = auth_header.split(' ')[1]
    # In a real app, you'd decode and verify the JWT here
    # For this example, we'll assume the token is valid if it's not empty

    # Return all users (excluding password hashes for security)
    users = [{"id": user["id"], "username": user["username"], "is_admin": user["is_admin"]} for user in users_db]
    return jsonify({"users": users})

if __name__ == '__main__':
    app.run(debug=True)