from datetime import datetime, timezone
from functools import wraps
import os

from flask import Flask, jsonify, request, g
import jwt

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("JWT_SECRET", "change-me-in-production")
app.config["JWT_ALGORITHM"] = "HS256"

# Example in-memory user store (replace with your DB/ORM)
USERS = {
    "1": {
        "id": "1",
        "email": "alice@example.com",
        "name": "Alice",
        "role": "user",
        "created_at": "2025-01-01T10:00:00Z",
        "password_hash": "$2b$12$examplehash",
        "mfa_secret": "TOPSECRET1",
        "recovery_codes": ["abc123", "def456"],
        "ssn": "111-22-3333",
    },
    "2": {
        "id": "2",
        "email": "bob@example.com",
        "name": "Bob",
        "role": "admin",
        "created_at": "2025-01-02T12:00:00Z",
        "password_hash": "$2b$12$examplehash2",
        "mfa_secret": "TOPSECRET2",
        "recovery_codes": ["ghi789", "jkl012"],
        "ssn": "444-55-6666",
    },
}

SENSITIVE_FIELDS = {
    "password_hash",
    "mfa_secret",
    "recovery_codes",
    "ssn",
    "reset_token",
    "api_key",
}


def decode_jwt(token: str):
    try:
        payload = jwt.decode(
            token,
            app.config["SECRET_KEY"],
            algorithms=[app.config["JWT_ALGORITHM"]],
            options={"require": ["sub", "exp"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_authenticated_user():
    # 1) Try session-based auth
    session_user_id = request.cookies.get("session_user_id")
    if session_user_id and session_user_id in USERS:
        return USERS[session_user_id]

    # 2) Try JWT Bearer auth
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        payload = decode_jwt(token)
        if payload:
            user_id = str(payload.get("sub"))
            if user_id in USERS:
                return USERS[user_id]

    return None


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = get_authenticated_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        g.current_user = user
        return f(*args, **kwargs)

    return wrapper


def sanitize_user(user_obj: dict) -> dict:
    return {k: v for k, v in user_obj.items() if k not in SENSITIVE_FIELDS}


@app.route("/api/users/<user_id>", methods=["GET"])
@login_required
def get_user_account(user_id):
    target_user = USERS.get(str(user_id))
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    requester = g.current_user
    is_admin = requester.get("role") == "admin"
    is_self = str(requester.get("id")) == str(user_id)

    if not (is_self or is_admin):
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"user": sanitize_user(target_user)}), 200


# Optional: local run
if __name__ == "__main__":
    app.run(debug=True)