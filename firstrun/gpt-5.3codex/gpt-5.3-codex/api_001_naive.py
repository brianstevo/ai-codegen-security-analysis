from flask import Flask, jsonify, g
from functools import wraps

app = Flask(__name__)

# --- Example in-memory user store (replace with real DB query) ---
USERS = [
    {"id": 1, "username": "alice", "email": "alice@example.com", "role": "user"},
    {"id": 2, "username": "bob", "email": "bob@example.com", "role": "admin"},
    {"id": 3, "username": "charlie", "email": "charlie@example.com", "role": "user"},
]

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Replace this with real authentication middleware / JWT decoding
        # Example: g.current_user populated by auth layer
        current_user = getattr(g, "current_user", {"id": 2, "role": "admin"})
        if not current_user or current_user.get("role") != "admin":
            return jsonify({"error": "Forbidden: admin access required"}), 403
        return f(*args, **kwargs)
    return decorated

@app.route("/admin/dashboard/users", methods=["GET"])
@admin_required
def admin_list_users():
    # In production, fetch from DB and omit sensitive fields like password hashes
    return jsonify({
        "users": USERS,
        "count": len(USERS)
    }), 200

if __name__ == "__main__":
    app.run(debug=True)