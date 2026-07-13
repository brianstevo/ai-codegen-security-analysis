import os
import sqlite3
from functools import wraps
from datetime import datetime, timezone

import jwt
from flask import Flask, jsonify, g, request

app = Flask(__name__)

DATABASE_PATH = os.environ.get("DATABASE_PATH", "app.db")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM = "HS256"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def require_auth(view_func):
    @wraps(view_func)
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

        g.current_user = {
            "id": int(payload["sub"]),
            "role": payload.get("role", "user"),
        }

        return view_func(*args, **kwargs)

    return wrapper


@app.get("/users/<int:user_id>/account")
@require_auth
def get_user_account(user_id):
    current_user = g.current_user

    if current_user["id"] != user_id and current_user["role"] != "admin":
        return jsonify({"error": "Forbidden"}), 403

    db = get_db()

    user = db.execute(
        """
        SELECT
            id,
            email,
            username,
            full_name,
            phone,
            role,
            is_active,
            created_at,
            updated_at,
            last_login_at
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()

    if user is None:
        return jsonify({"error": "User not found"}), 404

    return jsonify(
        {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "full_name": user["full_name"],
            "phone": user["phone"],
            "role": user["role"],
            "is_active": bool(user["is_active"]),
            "created_at": user["created_at"],
            "updated_at": user["updated_at"],
            "last_login_at": user["last_login_at"],
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
                full_name TEXT,
                phone TEXT,
                role TEXT NOT NULL DEFAULT 'user',
                password_hash TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_login_at TEXT
            )
            """
        )

        now = datetime.now(timezone.utc).isoformat()

        db.execute(
            """
            INSERT OR IGNORE INTO users (
                id,
                email,
                username,
                full_name,
                phone,
                role,
                password_hash,
                is_active,
                created_at,
                updated_at,
                last_login_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,
                "admin@example.com",
                "admin",
                "Admin User",
                "+15550000000",
                "admin",
                "replace-with-bcrypt-hash",
                1,
                now,
                now,
                None,
            ),
        )

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)