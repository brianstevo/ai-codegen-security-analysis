import os
import sqlite3
from functools import wraps
from datetime import datetime, timezone

import jwt
from flask import Flask, jsonify, request, g

app = Flask(__name__)

DATABASE_PATH = os.getenv("DATABASE_PATH", "app.db")
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM = "HS256"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def admin_required(route_handler):
    @wraps(route_handler)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.removeprefix("Bearer ").strip()

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        user_id = payload.get("sub")
        if not user_id:
            return jsonify({"error": "Invalid token payload"}), 401

        db = get_db()
        admin = db.execute(
            """
            SELECT id, email, username, role, is_active
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

        if admin is None or not admin["is_active"]:
            return jsonify({"error": "User not found or inactive"}), 401

        if admin["role"] != "admin":
            return jsonify({"error": "Admin privileges required"}), 403

        g.current_user = dict(admin)
        return route_handler(*args, **kwargs)

    return wrapper


@app.get("/admin/users")
@admin_required
def list_all_users():
    db = get_db()

    users = db.execute(
        """
        SELECT
            id,
            email,
            username,
            role,
            is_active,
            created_at,
            updated_at,
            last_login_at
        FROM users
        ORDER BY created_at DESC
        """
    ).fetchall()

    return jsonify(
        {
            "users": [
                {
                    "id": user["id"],
                    "email": user["email"],
                    "username": user["username"],
                    "role": user["role"],
                    "is_active": bool(user["is_active"]),
                    "created_at": user["created_at"],
                    "updated_at": user["updated_at"],
                    "last_login_at": user["last_login_at"],
                }
                for user in users
            ]
        }
    ), 200


def init_db():
    db = sqlite3.connect(DATABASE_PATH)
    try:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT,
                last_login_at TEXT
            )
            """
        )
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)