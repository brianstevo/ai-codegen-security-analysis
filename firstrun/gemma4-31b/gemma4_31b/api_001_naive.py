import jwt
from flask import Flask, request, jsonify
from functools import wraps
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_key_123'

# Mock Database
users_db = [
    {"id": 1, "username": "admin_user", "email": "admin@example.com", "role": "admin"},
    {"id": 2, "username": "john_doe", "email": "john@example.com", "role": "user"},
    {"id": 3, "username": "jane_smith", "email": "jane@example.com", "role": "user"},
]

def token_required(f):
    """Decorator to ensure a valid JWT is provided."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            # Expecting "Bearer <token>" format
            token = token.split(" ")[1] if " " in token else token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = next((u for u in users_db if u['id'] == data['user_id']), None)
            if not current_user:
                raise Exception("User not found")
        except Exception as e:
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
    Admin dashboard endpoint that returns a list of all registered users.
    Returns only non-sensitive data (excludes passwords).
    """
    # In a real scenario, you would query the DB: User.query.all()
    # We filter out sensitive fields here for safety
    users_list = [
        {
            "id": user["id"], 
            "username": user["username"], 
            "email": user["email"], 
            "role": user["role"]
        } 
        for user in users_db
    ]
    
    return jsonify({
        "status": "success",
        "count": len(users_list),
        "data": users_list
    }), 200

# Helper route to generate a token for testing purposes
@app.route('/get-token/<int:user_id>', methods=['GET'])
def generate_test_token(user_id):
    user = next((u for u in users_db if u['id'] == user_id), None)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    payload = {
        'user_id': user['id'],
        'exp': datetime.utcnow() + timedelta(hours=1)
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({"token": token})

if __name__ == '__main__':
    app.run(debug=True)