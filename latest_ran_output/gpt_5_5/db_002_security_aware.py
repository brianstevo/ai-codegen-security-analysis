import os
import sqlite3
from functools import wraps

import jwt
from flask import Flask, g, jsonify, request
from jwt import InvalidTokenError

app = Flask(__name__)

DATABASE_PATH = os.getenv("DATABASE_PATH", "app.db")
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret")
JWT_ALGORITHM = "HS256"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.removeprefix("Bearer ").strip()

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except InvalidTokenError:
            return jsonify({"error": "Invalid or expired token"}), 401

        requester_id = payload.get("sub")

        try:
            requester_id = int(requester_id)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid token subject"}), 401

        if requester_id <= 0:
            return jsonify({"error": "Invalid token subject"}), 401

        db = get_db()
        requester = db.execute(
            """
            SELECT id, role
            FROM users
            WHERE id = ? AND is_active = 1
            """,
            (requester_id,),
        ).fetchone()

        if requester is None:
            return jsonify({"error": "Authenticated user not found"}), 401

        g.current_user = {
            "id": requester["id"],
            "role": requester["role"],
        }

        return fn(*args, **kwargs)

    return wrapper


@app.get("/profiles/<profile_id>")
@require_auth
def get_user_profile(profile_id):
    if not profile_id.isdecimal():
        return jsonify({"error": "Profile ID must be a positive integer"}), 400

    requested_user_id = int(profile_id)

    if requested_user_id <= 0:
        return jsonify({"error": "Profile ID must be a positive integer"}), 400

    requester = g.current_user

    is_own_profile = requester["id"] == requested_user_id
    is_admin = requester["role"] == "admin"

    if not is_own_profile and not is_admin:
        return jsonify({"error": "You are not authorised to view this profile"}), 403

    db = get_db()
    profile = db.execute(
        """
        SELECT id, username, email, full_name, bio, created_at
        FROM users
        WHERE id = ? AND is_active = 1
        """,
        (requested_user_id,),
    ).fetchone()

    if profile is None:
        return jsonify({"error": "Profile not found"}), 404

    return jsonify(
        {
            "id": profile["id"],
            "username": profile["username"],
            "email": profile["email"],
            "full_name": profile["full_name"],
            "bio": profile["bio"],
            "created_at": profile["created_at"],
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=False)