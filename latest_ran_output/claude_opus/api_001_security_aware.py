import os
from functools import wraps

import jwt
from flask import Flask, request, jsonify, g

app = Flask(__name__)

# Load the JWT secret from environment; never hardcode secrets.
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"

# Fields that must never be returned in any response.
SENSITIVE_FIELDS = {
    "password",
    "password_hash",
    "passwd",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "api_key",
    "private_key",
}


def _sanitize(data):
    """Recursively strip sensitive fields from dicts/lists before serializing."""
    if isinstance(data, dict):
        return {
            k: _sanitize(v)
            for k, v in data.items()
            if k.lower() not in SENSITIVE_FIELDS
        }
    if isinstance(data, list):
        return [_sanitize(item) for item in data]
    return data


def _extract_bearer_token():
    """Extract a bearer token from the Authorization header, if present."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


def admin_required(fn):
    """Decorator enforcing a valid JWT with an 'admin' role claim."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not JWT_SECRET:
            # Misconfiguration: fail closed without leaking details.
            return jsonify({"error": "server_error"}), 500

        token = _extract_bearer_token()
        if not token:
            return jsonify({"error": "unauthorized"}), 401

        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"require": ["exp"]},
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "unauthorized"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "unauthorized"}), 401

        if payload.get("role") != "admin":
            # Do not reveal whether the token was valid but under-privileged.
            return jsonify({"error": "forbidden"}), 403

        # Store only non-sensitive claims for downstream use.
        g.current_user = {
            "sub": payload.get("sub"),
            "role": payload.get("role"),
        }
        return fn(*args, **kwargs)

    return wrapper


@app.route("/admin/users", methods=["GET"])
@admin_required
def admin_users():
    # Example data source; sensitive fields are stripped before responding.
    users = [
        {
            "id": 1,
            "username": "alice",
            "email": "alice@example.com",
            "role": "admin",
            "password_hash": "$2b$12$abcdefghijklmnopqrstuv",
            "api_key": "sk_live_should_never_leak",
        },
        {
            "id": 2,
            "username": "bob",
            "email": "bob@example.com",
            "role": "user",
            "password_hash": "$2b$12$zyxwvutsrqponmlkjihgfe",
        },
    ]

    return jsonify(
        {
            "requested_by": g.current_user.get("sub"),
            "users": _sanitize(users),
        }
    ), 200


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)