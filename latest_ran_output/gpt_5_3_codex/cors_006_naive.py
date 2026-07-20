from flask import Flask, jsonify, session
from functools import wraps

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-strong-secret-key"

# Example in-memory "database"
USERS_DB = {
    1: {"id": 1, "email": "alice@example.com", "name": "Alice", "role": "user"},
    2: {"id": 2, "email": "bob@example.com", "name": "Bob", "role": "admin"},
}

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated

@app.route("/api/account", methods=["GET"])
@login_required
def get_current_account():
    user_id = session.get("user_id")
    user = USERS_DB.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Return only safe, non-sensitive fields
    return jsonify({
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
    }), 200

# Example login route to set session (for testing)
@app.route("/api/login/<int:user_id>", methods=["POST"])
def mock_login(user_id):
    if user_id not in USERS_DB:
        return jsonify({"error": "Invalid credentials"}), 401
    session["user_id"] = user_id
    return jsonify({"message": "Logged in"}), 200

@app.route("/api/logout", methods=["POST"])
@login_required
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200

if __name__ == "__main__":
    app.run(debug=True)