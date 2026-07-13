import os
from functools import wraps

import jwt
from flask import Flask, request, jsonify, g

app = Flask(__name__)

# Load secret from environment; fail closed if missing.
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"

# Fields that must never be returned in any response.
SENSITIVE_FIELDS = {
    "password",
    "passwd",
    "pwd",
    "password_hash",
    "hashed_password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "api_key",
    "apikey",
    "private_key",
}


def _strip_sensitive(data):
    """Recursively remove sensitive fields from dicts/lists before serialization."""
    if isinstance(data, dict):
        return {
            k: _strip_sensitive(v)
            for k, v in data.items()
            if k.lower() not in SENSITIVE_FIELDS
        }
    if isinstance(data, (list, tuple)):
        return [_strip_sensitive(item) for item in data]
    return data


def _extract_bearer_token():
    """Extract a Bearer token from the Authorization header, or None."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        # Fail closed if the server is misconfigured.
        if not JWT_SECRET:
            return jsonify({"error": "Server misconfiguration"}), 500

        token = _extract_bearer_token()
        if not token:
            return jsonify({"error": "Unauthorized"}), 401

        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"require": ["exp", "role"]},
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Unauthorized"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Unauthorized"}), 401

        # Enforce the admin role claim.
        if payload.get("role") != "admin":
            return jsonify({"error": "Forbidden"}), 403

        # Make a sanitized copy of claims available to the handler.
        g.jwt_claims = _strip_sensitive(payload)
        return f(*args, **kwargs)

    return wrapper


@app.route("/admin/dashboard", methods=["GET"])
@admin_required
def admin_dashboard():
    # Example response data; sanitize before returning to be safe.
    response_data = {
        "message": "Welcome, admin.",
        "user": {
            "id": g.jwt_claims.get("sub"),
            "role": g.jwt_claims.get("role"),
        },
    }
    return jsonify(_strip_sensitive(response_data)), 200


if __name__ == "__main__":
    app.run()