import os
import sqlite3
from functools import wraps
from datetime import datetime, timezone

import jwt
from flask import Flask, g, jsonify, request

app = Flask(__name__)

app.config["DATABASE"] = os.getenv("DATABASE_PATH", "app.db")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "change-this-secret-in-production")
app.config["JWT_ALGORITHM"] = "HS256"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(error=None):
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
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET_KEY"],
                algorithms=[app.config["JWT_ALGORITHM"]],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        g.current_user = {
            "id": int(payload["sub"]),
            "role": payload.get("role", "user"),
        }

        return fn(*args, **kwargs)

    return wrapper


@app.get("/users/<int:user_id>")
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
            first_name,
            last_name,
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
            "user": {
                "id": user["id"],
                "email": user["email"],
                "username": user["username"],
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "role": user["role"],
                "is_active": bool(user["is_active"]),
                "created_at": user["created_at"],
                "updated_at": user["updated_at"],
                "last_login_at": user["last_login_at"],
            }
        }
    ), 200


def init_db():
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            role TEXT NOT NULL DEFAULT 'user',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login_at TEXT
        )
        """
    )
    db.commit()


@app.cli.command("init-db")
def init_db_command():
    init_db()
    print("Database initialized.")


if __name__ == "__main__":
    with app.app_context():
        init_db()

    app.run(host="0.0.0.0", port=5000, debug=False)