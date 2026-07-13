import jwt
import datetime
from functools import wraps
from flask import Flask, request, jsonify

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_key_123'

# Mock Database
users_db = {
    1: {"id": 1, "username": "alice", "email": "alice@example.com", "password_hash": "pbkdf2:sha256$...", "role": "user"},
    2: {"id": 2, "username": "bob", "email": "bob@example.com", "password_hash": "pbkdf2:sha256$...", "role": "user"},
    3: {"id": 3, "username": "admin_jane", "email": "jane@example.com", "password_hash": "pbkdf2:sha256$...", "role": "admin"},
}

# Fields that should never be returned in an API response
SENSITIVE_FIELDS = {'password_hash', 'secret_answer', 'mfa_token'}

def token_required(f):
    """Decorator to authenticate JWT and provide the current user context."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check for Authorization header: Bearer <token>
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({"message": "Invalid token format"}), 401

        if not token:
            return jsonify({"message": "Token is missing"}), 401

        try:
            # Decode JWT payload
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_db.get(data['user_id'])
            if not current_user:
                raise jwt.InvalidTokenError
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return jsonify({"message": "Token is invalid or expired"}), 401

        # Pass the authenticated user object to the route function
        return f(current_user, *args, **kwargs)
    return decorated

def sanitize_user_data(user_dict):
    """Returns a copy of the user dictionary without sensitive fields."""
    return {k: v for k, v in user_dict.items() if k not in SENSITIVE_FIELDS}

@app.route('/api/users/<int:user_id>', methods=['GET'])
@token_required
def get_user_account(current_user, user_id):
    """
    Returns account data for a specific user.
    Authorization: User can access their own ID or an Admin can access any ID.
    """
    target_user = users_db.get(user_id)

    if not target_user:
        return jsonify({"message": "User not found"}), 404

    # Authorization Logic: Check if requester is the owner OR an admin
    is_owner = current_user['id'] == user_id
    is_admin = current_user['role'] == 'admin'

    if not (is_owner or is_admin):
        return jsonify({"message": "Permission denied. You can only access your own data."}), 403

    # Strip sensitive fields before returning response
    safe_data = sanitize_user_data(target_user)
    return jsonify(safe_data), 200

@app.route('/api/login', methods=['POST'])
def login():
    """Helper route to generate a JWT for testing."""
    auth = request.json
    if not auth or not auth.get('username'):
        return jsonify({"message": "Missing credentials"}), 400

    # In production, verify password_hash here using bcrypt
    user = next((u for u in users_db.values() if u['username'] == auth['username']), None)
    if not user:
        return jsonify({"message": "Invalid credentials"}), 401

    token = jwt.encode({
        'user_id': user['id'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, app.config['SECRET_KEY'], algorithm="HS256")

    return jsonify({'token': token})

if __name__ == '__main__':
    app.run(debug=True)