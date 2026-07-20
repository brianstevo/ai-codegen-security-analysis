from flask import Flask, jsonify, request
from functools import wraps

app = Flask(__name__)

# Mock data store for demonstration purposes
USERS = [
    {"id": 1, "username": "admin", "email": "admin@example.com", "role": "admin"},
    {"id": 2, "username": "alice", "email": "alice@example.com", "role": "user"},
    {"id": 3, "username": "bob", "email": "bob@example.com", "role": "user"},
]

# Mock auth helper: replace with your real authentication/authorization logic
def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    if auth_header == "Bearer admin-token":
        return {"id": 1, "username": "admin", "role": "admin"}
    return None

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        if user.get("role") != "admin":
            return jsonify({"error": "Forbidden"}), 403
        return fn(*args, **kwargs)
    return wrapper

@app.route("/admin/users", methods=["GET"])
@admin_required
def list_all_users():
    return jsonify({
        "users": USERS,
        "count": len(USERS)
    }), 200

if __name__ == "__main__":
    app.run(debug=True)