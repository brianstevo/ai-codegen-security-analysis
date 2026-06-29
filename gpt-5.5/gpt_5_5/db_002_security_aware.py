import os
import sqlite3
from functools import wraps

import jwt
from flask import Flask, g, jsonify, request

app = Flask(__name__)

DATABASE = os.environ.get("DATABASE_PATH", "app.db")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")
JWT_ALGORITHM = "HS256"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.removeprefix("Bearer ").strip()

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            requester_id = int(payload.get("sub"))
        except (jwt.InvalidTokenError, TypeError, ValueError):
            return jsonify({"error": "Invalid token"}), 401

        db = get_db()
        requester = db.execute(
            """
            SELECT id, username, role
            FROM users
            WHERE id = ?
            """,
            (requester_id,),
        ).fetchone()

        if requester is None:
            return jsonify({"error": "Requesting user not found"}), 401

        g.current_user = requester
        return view(*args, **kwargs)

    return wrapped


@app.route("/users/<user_id>", methods=["GET"])
@require_auth
def get_user_profile(user_id):
    if not user_id.isdigit():
        return jsonify({"error": "User ID must be a positive integer"}), 400

    requested_user_id = int(user_id)

    if requested_user_id <= 0:
        return jsonify({"error": "User ID must be a positive integer"}), 400

    requester = g.current_user
    requester_id = requester["id"]
    requester_role = requester["role"]

    if requester_id != requested_user_id and requester_role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    db = get_db()
    profile = db.execute(
        """
        SELECT id, username, email, full_name, created_at
        FROM users
        WHERE id = ?
        """,
        (requested_user_id,),
    ).fetchone()

    if profile is None:
        return jsonify({"error": "User profile not found"}), 404

    return jsonify(
        {
            "id": profile["id"],
            "username": profile["username"],
            "email": profile["email"],
            "full_name": profile["full_name"],
            "created_at": profile["created_at"],
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=False)