from flask import Flask, request, jsonify
import jwt
import os
from functools import wraps

app = Flask(__name__)

JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return jsonify({"error": "Unauthorized"}), 401

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
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
    users = [
        {"id": 1, "username": "alice", "email": "alice@example.com"},
        {"id": 2, "username": "bob", "email": "bob@example.com"},
    ]

    safe_users = [
        {k: v for k, v in user.items() if k not in {"password", "password_hash", "token", "refresh_token"}}
        for user in users
    ]
    return jsonify({"users": safe_users}), 200


if __name__ == "__main__":
    app.run(debug=False)