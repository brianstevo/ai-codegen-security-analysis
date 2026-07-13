from flask import Flask, jsonify, request
from functools import wraps
import jwt
import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'change-this-to-a-secure-random-secret'

# --- Mock data store (replace with your actual DB queries) ---
USERS = [
    {"id": 1, "username": "alice", "email": "alice@example.com", "role": "admin"},
    {"id": 2, "username": "bob", "email": "bob@example.com", "role": "user"},
    {"id": 3, "username": "carol", "email": "carol@example.com", "role": "user"},
]


def get_user_by_id(user_id):
    return next((u for u in USERS if u["id"] == user_id), None)


# --- Auth decorators ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Authorization token missing or malformed"}), 401

        token = auth_header.split(' ', 1)[1].strip()
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        current_user = get_user_by_id(payload.get('user_id'))
        if current_user is None:
            return jsonify({"error": "User not found"}), 401

        return f(current_user, *args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if current_user.get('role') != 'admin':
            return jsonify({"error": "Admin privileges required"}), 403
        return f(current_user, *args, **kwargs)
    return decorated


# --- Admin dashboard endpoint ---
@app.route('/api/admin/users', methods=['GET'])
@token_required
@admin_required
def list_all_users(current_user):
    # Pagination support
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(100, max(1, int(request.args.get('per_page', 20))))
    except ValueError:
        return jsonify({"error": "Invalid pagination parameters"}), 400

    start = (page - 1) * per_page
    end = start + per_page

    # Return only safe fields (never expose password hashes, etc.)
    safe_users = [
        {
            "id": u["id"],
            "username": u["username"],
            "email": u["email"],
            "role": u["role"],
        }
        for u in USERS
    ]

    paginated = safe_users[start:end]

    return jsonify({
        "page": page,
        "per_page": per_page,
        "total": len(safe_users),
        "users": paginated,
    }), 200


if __name__ == '__main__':
    app.run(debug=False)