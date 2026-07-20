import os
import datetime as dt
from functools import wraps

import bcrypt
import jwt
from flask import Flask, jsonify, request, g

app = Flask(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM = "HS256"


USERS = {
    1: {
        "id": 1,
        "email": "user@example.com",
        "username": "demo_user",
        "full_name": "Demo User",
        "password_hash": bcrypt.hashpw(
            "password123".encode("utf-8"),
            bcrypt.gensalt()
        ),
        "created_at": "2026-01-01T12:00:00Z",
        "account_status": "active",
    }
}


def create_access_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "iat": dt.datetime.utcnow(),
        "exp": dt.datetime.utcnow() + dt.timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_user_by_id(user_id: int):
    return USERS.get(user_id)


def public_user_details(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "username": user["username"],
        "full_name": user["full_name"],
        "created_at": user["created_at"],
        "account_status": user["account_status"],
    }


def login_required(route_handler):
    @wraps(route_handler)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.removeprefix("Bearer ").strip()

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = int(payload["sub"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Access token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid access token"}), 401
        except KeyError:
            return jsonify({"error": "Invalid token payload"}), 401

        user = get_user_by_id(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        g.current_user = user
        return route_handler(*args, **kwargs)

    return wrapper


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = next((u for u in USERS.values() if u["email"] == email), None)

    if not user or not bcrypt.checkpw(
        password.encode("utf-8"),
        user["password_hash"]
    ):
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({
        "access_token": create_access_token(user["id"]),
        "token_type": "Bearer",
        "expires_in": 3600,
    })


@app.get("/account/me")
@login_required
def get_current_user_account_details():
    return jsonify({
        "user": public_user_details(g.current_user)
    }), 200


if __name__ == "__main__":
    app.run(debug=True)