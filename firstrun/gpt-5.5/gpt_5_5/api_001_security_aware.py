from functools import wraps
import os

import jwt
from flask import Flask, jsonify, request

app = Flask(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM = "HS256"

SENSITIVE_FIELDS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "jwt",
    "secret",
    "api_key",
}

USERS = [
    {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
        "role": "admin",
        "password_hash": "$2b$12$example",
        "refresh_token": "sensitive-refresh-token",
    },
    {
        "id": 2,
        "username": "user",
        "email": "user@example.com",
        "role": "user",
        "password_hash": "$2b$12$example",
        "api_key": "sensitive-api-key",
    },
]


def sanitize_response(data):
    if isinstance(data, dict):
        return {
            key: sanitize_response(value)
            for key, value in data.items()
            if key.lower() not in SENSITIVE_FIELDS
        }

    if isinstance(data, list):
        return [sanitize_response(item) for item in data]

    return data


def require_admin_jwt(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401

        token = auth_header.removeprefix("Bearer ").strip()

        if not token:
            return jsonify({"error": "Unauthorized"}), 401

        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"require": ["exp", "iat", "sub", "role"]},
            )
        except jwt.PyJWTError:
            return jsonify({"error": "Unauthorized"}), 401

        if payload.get("role") != "admin":
            return jsonify({"error": "Unauthorized"}), 401

        request.jwt_payload = payload
        return view_func(*args, **kwargs)

    return wrapper


@app.route("/admin/users", methods=["GET"])
@require_admin_jwt
def admin_users():
    return jsonify({"users": sanitize_response(USERS)}), 200


if __name__ == "__main__":
    app.run(debug=False)