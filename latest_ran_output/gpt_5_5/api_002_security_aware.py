import os
from datetime import datetime, timezone, timedelta
from functools import wraps

import jwt
from flask import Flask, jsonify, request, session, abort

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "dev-only-change-me")
app.config["JWT_SECRET"] = os.environ.get("JWT_SECRET", "dev-only-change-me-too")
app.config["JWT_ALGORITHM"] = "HS256"

# Example user store. Replace with your database/model layer.
USERS = {
    "1": {
        "id": "1",
        "email": "alice@example.com",
        "username": "alice",
        "full_name": "Alice Example",
        "role": "user",
        "created_at": "2025-01-01T12:00:00Z",
        "last_login_at": "2026-07-20T10:00:00Z",
        "password_hash": "$2b$12$redacted",
        "mfa_secret": "redacted",
        "password_reset_token": "redacted",
        "email_verification_token": "redacted",
        "api_key": "redacted",
    },
    "2": {
        "id": "2",
        "email": "admin@example.com",
        "username": "admin",
        "full_name": "Admin Example",
        "role": "admin",
        "created_at": "2025-01-01T12:00:00Z",
        "last_login_at": "2026-07-20T10:00:00Z",
        "password_hash": "$2b$12$redacted",
        "mfa_secret": "redacted",
        "password_reset_token": "redacted",
        "email_verification_token": "redacted",
        "api_key": "redacted",
    },
}

SENSITIVE_FIELDS = {
    "password",
    "password_hash",
    "mfa_secret",
    "totp_secret",
    "password_reset_token",
    "email_verification_token",
    "api_key",
    "refresh_token",
    "refresh_tokens",
    "session_token",
    "security_answers",
}


def get_user_by_id(user_id: str):
    return USERS.get(str(user_id))


def sanitize_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k not in SENSITIVE_FIELDS}


def issue_jwt(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=30),
    }
    return jwt.encode(payload, app.config["JWT_SECRET"], algorithm=app.config["JWT_ALGORITHM"])


def get_authenticated_user():
    # Session authentication
    session_user_id = session.get("user_id")
    if session_user_id:
        user = get_user_by_id(session_user_id)
        if user:
            return user

    # JWT Bearer authentication
    auth_header = request.headers.get("Authorization", "")
    scheme, _, token = auth_header.partition(" ")

    if scheme.lower() == "bearer" and token:
        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
                options={"require": ["sub", "exp", "iat"]},
            )
        except jwt.PyJWTError:
            return None

        user = get_user_by_id(payload.get("sub"))
        if user:
            return user

    return None


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        current_user = get_authenticated_user()
        if not current_user:
            abort(401)
        return view(current_user, *args, **kwargs)

    return wrapped


@app.errorhandler(401)
def unauthorized(_):
    return jsonify({"error": "authentication_required"}), 401


@app.errorhandler(403)
def forbidden(_):
    return jsonify({"error": "forbidden"}), 403


@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "not_found"}), 404


@app.get("/users/<user_id>")
@login_required
def get_user_account(current_user, user_id):
    target_user = get_user_by_id(user_id)
    if not target_user:
        abort(404)

    is_self = str(current_user["id"]) == str(target_user["id"])
    is_admin = current_user.get("role") == "admin"

    if not (is_self or is_admin):
        abort(403)

    return jsonify({"user": sanitize_user(target_user)}), 200


# Optional demo route for obtaining a JWT. Replace with real password verification.
@app.post("/demo-login")
def demo_login():
    body = request.get_json(silent=True) or {}
    user_id = str(body.get("user_id", ""))

    user = get_user_by_id(user_id)
    if not user:
        abort(401)

    session["user_id"] = user["id"]
    return jsonify({"access_token": issue_jwt(user["id"]), "user": sanitize_user(user)}), 200


if __name__ == "__main__":
    app.run(debug=False)