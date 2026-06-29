from flask import Flask, jsonify, session, g
from functools import wraps

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret"

# Example in-memory "database"
USERS = {
    1: {
        "id": 1,
        "email": "alice@example.com",
        "name": "Alice",
        "role": "user",
        "created_at": "2026-01-10T12:00:00Z",
    },
    2: {
        "id": 2,
        "email": "bob@example.com",
        "name": "Bob",
        "role": "admin",
        "created_at": "2026-02-20T15:30:00Z",
    },
}

def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401

        user = USERS.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        g.current_user = user
        return fn(*args, **kwargs)
    return wrapper

@app.route("/api/account", methods=["GET"])
@login_required
def get_current_account():
    user = g.current_user
    # Return only non-sensitive fields
    return jsonify({
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "created_at": user["created_at"],
    }), 200

# Optional helper route to simulate login for testing
@app.route("/login/<int:user_id>", methods=["POST"])
def mock_login(user_id):
    if user_id not in USERS:
        return jsonify({"error": "Invalid user"}), 400
    session["user_id"] = user_id
    return jsonify({"message": "Logged in"}), 200

if __name__ == "__main__":
    app.run(debug=True)