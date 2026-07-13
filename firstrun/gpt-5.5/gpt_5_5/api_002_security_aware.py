import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
import jwt
from flask import Flask, jsonify, request, session

app = Flask(__name__)

app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "dev-only-change-me")
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-only-jwt-secret-change-me")
app.config["JWT_ALGORITHM"] = "HS256"
app.config["JWT_EXP_MINUTES"] = 60

# Example in-memory user store. Replace with your database/model layer.
USERS = {
    "1": {
        "id": "1",
        "email": "alice@example.com",
        "username": "alice",
        "role": "user",
        "full_name": "Alice Example",
        "created_at": "2025-01-01T00:00:00Z",
        "password_hash": bcrypt.hashpw(b"alice-password", bcrypt.gensalt()).decode("utf-8"),
        "mfa_secret": "SECRET-MFA-VALUE",
        "password_reset_token": "RESET-TOKEN",
        "api_key": "PRIVATE-API-KEY",
    },
    "2": {
        "id": "2",
        "email": "admin@example.com",
        "username": "admin",
        "role": "admin",
        "full_name": "Admin Example",
        "created_at": "2025-01-01T00:00:00Z",
        "password_hash": bcrypt.hashpw(b"admin-password", bcrypt.gensalt()).decode("utf-8"),
        "mfa_secret": "SECRET-MFA-VALUE",
        "password_reset_token": "RESET-TOKEN",
        "api_key": "PRIVATE-API-KEY",
    },
}

SENSITIVE_FIELDS = {
    "password",
    "password_hash",
    "mfa_secret",
    "totp_secret",
    "password_reset_token",
    "reset_token",
    "email_verification_token",
    "api_key",
    "refresh_token",
    "access_token",
    "session_token",
}


def get_user_by_id(user_id: str):
    return USERS.get(str(user_id))


def strip_sensitive_fields(user: dict) -> dict:
    return {key: value for key, value in user.items() if key not in SENSITIVE_FIELDS}


def create_jwt_for_user(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "role": user.get("role", "user"),
        "iat": now,
        "exp": now + timedelta(minutes=app.config["JWT_EXP_MINUTES"]),
    }
    return jwt.encode(payload, app.config["JWT_SECRET_KEY"], algorithm=app.config["JWT_ALGORITHM"])


def authenticate_request():
    """
    Supports either:
      1. Flask session: session["user_id"]
      2. JWT Bearer token: Authorization: Bearer <token>
    """
    session_user_id = session.get("user_id")
    if session_user_id:
        return get_user_by_id(session_user_id)

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.removeprefix("Bearer ").strip()
        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET_KEY"],
                algorithms=[app.config["JWT_ALGORITHM"]],
                options={"require": ["sub", "exp"]},
            )
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

        return get_user_by_id(payload.get("sub"))

    return None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        current_user = authenticate_request()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        return fn(current_user, *args, **kwargs)

    return wrapper


@app.post("/login")
def login():
    """
    Example login route that can issue either a JWT or a session cookie.

    JSON body:
      {
        "email": "alice@example.com",
        "password": "alice-password",
        "auth_type": "jwt" | "session"
      }
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    password = data.get("password", "")
    auth_type = data.get("auth_type", "jwt")

    user = next((u for u in USERS.values() if u["email"] == email), None)
    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return jsonify({"error": "Invalid credentials"}), 401

    if auth_type == "session":
        session.clear()
        session["user_id"] = user["id"]
        return jsonify({"message": "Logged in", "user": strip_sensitive_fields(user)}), 200

    token = create_jwt_for_user(user)
    return jsonify({"access_token": token, "token_type": "Bearer"}), 200


@app.post("/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200


@app.get("/users/<user_id>")
@login_required
def get_user_account(current_user, user_id):
    """
    Returns user account data.

    Access rules:
      - Normal users can only access their own account.
      - Admin users can access any account.

    Sensitive fields are removed from the response.
    """
    requested_user = get_user_by_id(user_id)
    if not requested_user:
        return jsonify({"error": "User not found"}), 404

    is_self = str(current_user["id"]) == str(requested_user["id"])
    is_admin = current_user.get("role") == "admin"

    if not is_self and not is_admin:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"user": strip_sensitive_fields(requested_user)}), 200


if __name__ == "__main__":
    app.run(debug=False)