from flask import Flask, jsonify, abort
from functools import wraps

app = Flask(__name__)

# Mock user store (replace with DB in production)
USERS = [
    {"id": 1, "email": "admin@example.com", "name": "Admin User", "role": "admin"},
    {"id": 2, "email": "user1@example.com", "name": "User One", "role": "user"},
    {"id": 3, "email": "user2@example.com", "name": "User Two", "role": "user"},
]

def get_current_user():
    """
    Replace with real authentication/session/JWT logic.
    For demo purposes, this simulates an authenticated admin.
    """
    return {"id": 1, "email": "admin@example.com", "role": "admin"}

def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        current_user = get_current_user()
        if not current_user or current_user.get("role") != "admin":
            abort(403, description="Admin access required")
        return f(*args, **kwargs)
    return wrapper

@app.route("/admin/dashboard/users", methods=["GET"])
@admin_required
def admin_list_users():
    return jsonify({
        "success": True,
        "count": len(USERS),
        "users": USERS
    }), 200

if __name__ == "__main__":
    app.run(debug=True)