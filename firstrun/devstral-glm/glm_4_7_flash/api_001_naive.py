from flask import Flask, jsonify, request
import jwt
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'

# Mock Database
users = [
    {"id": 1, "username": "alice", "email": "alice@example.com", "role": "user"},
    {"id": 2, "username": "bob", "email": "bob@example.com", "role": "admin"},
    {"id": 3, "username": "charlie", "email": "charlie@example.com", "role": "user"}
]

def generate_admin_token():
    """Helper to generate a valid admin JWT for testing purposes."""
    payload = {"user_id": 2, "role": "admin"}
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")

@app.route('/admin/users', methods=['GET'])
def get_all_users():
    """
    Admin endpoint to retrieve a list of all users.
    Requires a valid JWT token with 'admin' role in the payload.
    """
    auth_header = request.headers.get('Authorization')

    if not auth_header:
        return jsonify({"error": "Authorization header missing"}), 401

    try:
        # Expecting format: "Bearer <token>"
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])

        # Authorization check
        if payload.get('role') != 'admin':
            return jsonify({"error": "Admin access required"}), 403

    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except IndexError:
        return jsonify({"error": "Invalid authorization format"}), 401

    # Return the list of users
    return jsonify(users), 200

if __name__ == '__main__':
    app.run(debug=True)