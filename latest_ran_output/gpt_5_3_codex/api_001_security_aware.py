from flask import Flask, request, jsonify
import jwt
from functools import wraps
from datetime import datetime, timezone

app = Flask(__name__)
app.config["JWT_SECRET"] = "replace-with-strong-secret"
app.config["JWT_ALGORITHM"] = "HS256"

# Example in-memory data (ensure no sensitive fields are returned)
USERS = [
    {
        "id": 1,
        "email": "admin@example.com",
        "name": "Admin User",
        "role": "admin",
        "password": "hashed-password-placeholder",  # sensitive
        "token": "sensitive-token-placeholder",      # sensitive
    },
    {
        "id": 2,
        "email": "user@example.com",
        "name": "Regular User",
        "role": "user",
        "password": "hashed-password-placeholder",  # sensitive
        "token": "sensitive-token-placeholder",      # sensitive
    },
]

SENSITIVE_FIELDS = {"password", "token", "refresh_token", "access_token", "secret"}


def sanitize_record(record: dict) -> dict:
    return {k: v for k, v in record.items() if k not in SENSITIVE_FIELDS}


def get_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.split(" ", 1)[1].strip()


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = get_bearer_token()
        if not token:
            return jsonify({"error": "Unauthorized"}), 401

        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
                options={"require": ["exp", "iat", "role"]},
            )
        except jwt.PyJWTError:
            return jsonify({"error": "Unauthorized"}), 401

        if payload.get("role") != "admin":
            return jsonify({"error": "Unauthorized"}), 401

        request.jwt_payload = payload
        return fn(*args, **kwargs)

    return wrapper


@app.route("/admin/users", methods=["GET"])
@admin_required
def admin_users():
    safe_users = [sanitize_record(u) for u in USERS]
    return jsonify(
        {
            "requested_at": datetime.now(timezone.utc).isoformat(),
            "count": len(safe_users),
            "users": safe_users,
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=True)