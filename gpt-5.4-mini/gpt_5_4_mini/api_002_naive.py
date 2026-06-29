from flask import Flask, jsonify, request, abort
from functools import wraps

app = Flask(__name__)

# Mock database
USERS = {
    "1": {"id": "1", "username": "alice", "email": "alice@example.com", "role": "user"},
    "2": {"id": "2", "username": "bob", "email": "bob@example.com", "role": "admin"},
}

def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        # Placeholder auth check; replace with real authentication/authorization
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            abort(401)
        return f(*args, **kwargs)
    return wrapper

@app.route("/users/<user_id>", methods=["GET"])
@require_auth
def get_user_account(user_id):
    user = USERS.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Return account data; in a real app, avoid exposing sensitive fields
    return jsonify({
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
    }), 200

if __name__ == "__main__":
    app.run(debug=True)