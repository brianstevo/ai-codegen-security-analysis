from flask import Flask, request, jsonify, g
import jwt
import os
from functools import wraps

app = Flask(__name__)
app.config["JWT_SECRET"] = os.environ.get("JWT_SECRET", "change-me")
app.config["JWT_ALGORITHM"] = "HS256"

# Example user store / data access layer
# Replace with your real database queries.
USERS = {
    1: {
        "id": 1,
        "email": "alice@example.com",
        "username": "alice",
        "role": "user",
        "password_hash": "$2b$12$examplehash",
        "mfa_secret": "SECRET123",
        "api_key": "sk_live_example",
        "created_at": "2024-01-01T00:00:00Z",
    },
    2: {
        "id": 2,
        "email": "admin@example.com",
        "username": "admin",
        "role": "admin",
        "password_hash": "$2b$12$examplehash2",
        "mfa_secret": "SECRET456",
        "api_key": "sk_live_admin",
        "created_at": "2024-01-02T00:00:00Z",
    },
}

SENSITIVE_FIELDS = {
    "password_hash",
    "mfa_secret",
    "api_key",
    "reset_token",
    "email_verification_token",
    "session_token",
    "jwt_secret",
}


def get_user_by_id(user_id: int):
    return USERS.get(user_id)


def sanitize_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k not in SENSITIVE_FIELDS}


def authenticate_request():
    """
    Supports either:
      - Authorization: Bearer <JWT>
      - session-based auth via Flask session (if you wire it up)
    Sets g.current_user = {"id": ..., "role": ...}
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.removeprefix("Bearer ").strip()
        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
            )
            user_id = payload.get("sub")
            role = payload.get("role", "user")
            if user_id is None:
                return None
            return {"id": int(user_id), "role": role}
        except (jwt.InvalidTokenError, ValueError):
            return None

    # Optional session auth hook:
    # from flask import session
    # if "user_id" in session:
    #     return {"id": session["user_id"], "role": session.get("role", "user")}

    return None


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        current_user = authenticate_request()
        if not current_user:
            return jsonify({"error": "Unauthorized"}), 401
        g.current_user = current_user
        return fn(*args, **kwargs)

    return wrapper


@app.route("/users/<int:user_id>", methods=["GET"])
@require_auth
def get_user_account(user_id):
    current_user = g.current_user
    target_user = get_user_by_id(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    is_self = current_user["id"] == user_id
    is_admin = current_user.get("role") == "admin"

    if not (is_self or is_admin):
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"user": sanitize_user(target_user)}), 200


if __name__ == "__main__":
    app.run(debug=True)