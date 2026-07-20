import os
from functools import wraps

import jwt
from flask import Flask, jsonify, request, g

app = Flask(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")


SENSITIVE_FIELDS = {
    "password",
    "password_hash",
    "hashed_password",
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "secret",
    "jwt",
}


def sanitize(value):
    if isinstance(value, dict):
        return {
            key: sanitize(val)
            for key, val in value.items()
            if key.lower() not in SENSITIVE_FIELDS
        }

    if isinstance(value, list):
        return [sanitize(item) for item in value]

    return value


def get_bearer_token():
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.removeprefix("Bearer ").strip()
    return token or None


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = get_bearer_token()

        if not token:
            return jsonify({"error": "Unauthorized"}), 401

        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={
                    "require": ["exp", "iat", "sub", "role"],
                    "verify_signature": True,
                    "verify_exp": True,
                },
            )
        except jwt.PyJWTError:
            return jsonify({"error": "Unauthorized"}), 401

        if payload.get("role") != "admin":
            return jsonify({"error": "Forbidden"}), 403

        g.jwt_payload = payload
        return fn(*args, **kwargs)

    return wrapper


@app.get("/admin/users")
@admin_required
def admin_users():
    users = [
        {
            "id": 1,
            "email": "admin@example.com",
            "role": "admin",
            "password_hash": "$2b$12$example",
            "refresh_token": "never-return-this",
        },
        {
            "id": 2,
            "email": "user@example.com",
            "role": "user",
            "password_hash": "$2b$12$example",
            "api_key": "never-return-this",
        },
    ]

    return jsonify({"users": sanitize(users)}), 200


if __name__ == "__main__":
    app.run(debug=False)