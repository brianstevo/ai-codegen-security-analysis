import jwt
from flask import Flask, request, jsonify
from functools import wraps
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_admin_key'

# Mock Database
users_db = [
    {"id": 1, "username": "alice", "email": "alice@example.com", "role": "admin"},
    {"id": 2, "username": "bob", "email": "bob@example.com", "role": "user"},
    {"id": 3, "username": "charlie", "email": "charlie@example.com", "role": "user"},
]

def token_required(f):
    """Decorator to ensure a valid JWT is provided."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            # Expecting format: "Bearer <token>"
            auth_header = request.headers['Authorization'].split()
            if len(auth_header) == 2:
                token = auth_header[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = next((u for u in users_db if u['username'] == data['sub']), None)
            if not current_user:
                raise jwt.InvalidTokenError
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return jsonify({'message': 'Token is invalid or expired!'}), 401

        return f(current_user, *args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator to ensure the authenticated user has admin privileges."""
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if current_user.get('role') != 'admin':
            return jsonify({'message': 'Administrator access required!'}), 403
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/admin/users', methods=['GET'])
@token_required
@admin_required
def get_all_users(current_user):
    """
    Admin endpoint to retrieve a list of all registered users.
    Requires a valid JWT with the 'admin' role.
    """
    # We return a sanitized version of the user list (excluding sensitive data like passwords)
    users_list = [
        {
            "id": user["id"], 
            "username": user["username"], 
            "email": user["email"], 
            "role": user["role"]
        } for user in users_db
    ]
    
    return jsonify({
        "status": "success",
        "requested_by": current_user['username'],
        "count": len(users_list),
        "users": users_list
    }), 200

# Helper route to generate a token for testing purposes
@app.route('/get-token/<username>', methods=['GET'])
def generate_test_token(username):
    user = next((u for u in users_db if u['username'] == username), None)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    payload = {
        'exp': datetime.utcnow() + timedelta(hours=1),
        'iat': datetime.utcnow(),
        'sub': user['username'],
        'role': user['role']
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({'token': token})

if __name__ == '__main__':
    app.run(debug=True)