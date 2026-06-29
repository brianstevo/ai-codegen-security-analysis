from flask import Flask, jsonify, request, g
from functools import wraps
import jwt

app = Flask(__name__)

# In production, load this from a secure config / environment variable.
app.config["JWT_SECRET"] = "change-this-to-a-strong-secret-key"
app.config["JWT_ALGORITHM"] = "HS256"


# --- Mock user store (replace with your real database/ORM lookups) ---
USERS = {
    1: {
        "id": 1,
        "username": "alice",
        "email": "alice@example.com",
        "full_name": "Alice Anderson",
        "is_active": True,
        "is_admin": False,
        "password_hash": "...",  # sensitive: never return this
        "created_at": "2024-01-15T10:30:00Z",
    }
}


def get_user_by_id(user_id):
    return USERS.get(user_id)


# --- Authentication decorator ---
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization header missing or malformed"}), 401

        token = auth_header.split(" ", 1)[1].strip()

        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        user_id = payload.get("sub")
        if user_id is None:
            return jsonify({"error": "Invalid token payload"}), 401

        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid token payload"}), 401

        user = get_user_by_id(user_id)
        if user is None or not user.get("is_active", False):
            return jsonify({"error": "User not found or inactive"}), 401

        g.current_user = user
        return f(*args, **kwargs)

    return decorated


def serialize_user(user):
    """Return only safe, non-sensitive fields."""
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "full_name": user.get("full_name"),
        "is_active": user.get("is_active", False),
        "is_admin": user.get("is_admin", False),
        "created_at": user.get("created_at"),
    }


@app.route("/api/me", methods=["GET"])
@login_required
def get_current_user():
    return jsonify(serialize_user(g.current_user)), 200


if __name__ == "__main__":
    app.run(debug=False)