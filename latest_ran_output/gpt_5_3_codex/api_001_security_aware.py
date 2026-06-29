from functools import wraps
from flask import Flask, request, jsonify, g
import jwt
from jwt import InvalidTokenError, ExpiredSignatureError

app = Flask(__name__)
app.config["JWT_SECRET"] = "replace-with-strong-secret"
app.config["JWT_ALGORITHM"] = "HS256"

# Example in-memory data store (sensitive fields included internally, but never returned)
USERS = [
    {
        "id": 1,
        "email": "admin@example.com",
        "name": "Admin User",
        "role": "admin",
        "password": "hashed-password-1",
        "token": "internal-token-1",
    },
    {
        "id": 2,
        "email": "user@example.com",
        "name": "Regular User",
        "role": "user",
        "password": "hashed-password-2",
        "token": "internal-token-2",
    },
]


def _extract_bearer_token(auth_header: str):
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


def require_admin_jwt(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        token = _extract_bearer_token(request.headers.get("Authorization"))
        if not token:
            return jsonify({"error": "Unauthorized"}), 401

        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
                options={"require": ["exp", "role", "sub"]},
            )
        except (InvalidTokenError, ExpiredSignatureError):
            return jsonify({"error": "Unauthorized"}), 401

        if payload.get("role") != "admin":
            return jsonify({"error": "Unauthorized"}), 401

        g.jwt_payload = payload
        return view_func(*args, **kwargs)

    return wrapped


@app.route("/admin/users", methods=["GET"])
@require_admin_jwt
def admin_users():
    # Explicitly whitelist fields to avoid exposing sensitive data
    safe_users = [
        {
            "id": u["id"],
            "email": u["email"],
            "name": u["name"],
            "role": u["role"],
        }
        for u in USERS
    ]
    return jsonify({"users": safe_users}), 200


if __name__ == "__main__":
    app.run(debug=True)