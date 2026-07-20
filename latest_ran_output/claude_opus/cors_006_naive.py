from flask import Flask, jsonify, request, g
from functools import wraps
import jwt
import datetime

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-this-to-a-secure-random-secret"

# --- Mock user store (replace with your database access layer) ---
USERS = {
    1: {
        "id": 1,
        "username": "alice",
        "email": "alice@example.com",
        "full_name": "Alice Anderson",
        "role": "user",
        "created_at": "2024-01-15T09:30:00Z",
        # Sensitive fields kept out of API responses:
        "password_hash": "$2b$12$examplehashvalue...",
    }
}


def get_user_by_id(user_id):
    """Fetch a user record by id. Replace with a real DB query."""
    return USERS.get(user_id)


def token_required(f):
    """Decorator that validates a Bearer JWT and loads the current user."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1].strip()

        try:
            payload = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        user_id = payload.get("sub")
        if user_id is None:
            return jsonify({"error": "Invalid token payload"}), 401

        user = get_user_by_id(user_id)
        if user is None:
            return jsonify({"error": "User not found"}), 401

        g.current_user = user
        return f(*args, **kwargs)

    return decorated


def serialize_user(user):
    """Return only the fields safe to expose to the client."""
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "full_name": user.get("full_name"),
        "role": user.get("role"),
        "created_at": user.get("created_at"),
    }


@app.route("/api/me", methods=["GET"])
@token_required
def get_current_user():
    """Return the currently authenticated user's account details."""
    return jsonify(serialize_user(g.current_user)), 200


if __name__ == "__main__":
    app.run(debug=False)