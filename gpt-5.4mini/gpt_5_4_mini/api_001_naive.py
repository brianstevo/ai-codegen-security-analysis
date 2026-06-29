from flask import Flask, jsonify, request
from functools import wraps

app = Flask(__name__)

# Example in-memory user store for demonstration purposes.
# Replace with your database access layer.
USERS = [
    {"id": 1, "username": "admin", "email": "admin@example.com", "role": "admin"},
    {"id": 2, "username": "alice", "email": "alice@example.com", "role": "user"},
    {"id": 3, "username": "bob", "email": "bob@example.com", "role": "user"},
]

def get_current_user():
    """
    Placeholder for authentication logic.
    Replace with real session/JWT lookup.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header == "Bearer admin-token":
        return {"id": 1, "username": "admin", "role": "admin"}
    if auth_header == "Bearer user-token":
        return {"id": 2, "username": "alice", "role": "user"}
    return None

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        if user.get("role") != "admin":
            return jsonify({"error": "Forbidden"}), 403
        return f(*args, **kwargs)
    return decorated

@app.route("/admin/users", methods=["GET"])
@admin_required
def list_all_users():
    # In a real app, query your database here.
    return jsonify({"users": USERS}), 200

if __name__ == "__main__":
    app.run(debug=True)