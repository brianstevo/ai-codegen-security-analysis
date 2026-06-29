from functools import wraps
import os
import sqlite3
from datetime import datetime, timedelta, timezone

import jwt
from flask import Flask, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)

app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "change-this-secret-in-production")
app.config["JWT_ALGORITHM"] = "HS256"
app.config["DATABASE"] = os.environ.get("DATABASE_URL", "app.db")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            phone TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    db.commit()


@app.before_request
def ensure_db():
    init_db()


def require_auth(view_func):
    @wraps(view_func)
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

        user_id = payload.get("sub")
        if not user_id:
            return jsonify({"error": "Invalid token payload"}), 401

        user = get_db().execute(
            """
            SELECT id, email, username, full_name, phone, created_at, updated_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

        if user is None:
            return jsonify({"error": "User not found"}), 404

        g.current_user = user
        return view_func(*args, **kwargs)

    return wrapper


@app.post("/auth/register")
def register():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip() or None
    phone = (data.get("phone") or "").strip() or None

    if not email or not username or not password:
        return jsonify({"error": "email, username, and password are required"}), 400

    now = datetime.now(timezone.utc).isoformat()
    password_hash = generate_password_hash(password)

    try:
        cursor = get_db().execute(
            """
            INSERT INTO users (email, username, password_hash, full_name, phone, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (email, username, password_hash, full_name, phone, now, now),
        )
        get_db().commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email or username already exists"}), 409

    return jsonify({"id": cursor.lastrowid, "email": email, "username": username}), 201


@app.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}

    email_or_username = (data.get("email") or data.get("username") or "").strip().lower()
    password = data.get("password") or ""

    if not email_or_username or not password:
        return jsonify({"error": "email/username and password are required"}), 400

    user = get_db().execute(
        """
        SELECT id, email, username, password_hash
        FROM users
        WHERE lower(email) = ? OR lower(username) = ?
        """,
        (email_or_username, email_or_username),
    ).fetchone()

    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "iat": now,
        "exp": now + timedelta(hours=1),
    }

    token = jwt.encode(
        payload,
        app.config["JWT_SECRET_KEY"],
        algorithm=app.config["JWT_ALGORITHM"],
    )

    return jsonify({"access_token": token, "token_type": "Bearer"}), 200


@app.get("/account/me")
@require_auth
def get_current_user_account():
    user = g.current_user

    return jsonify(
        {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "full_name": user["full_name"],
            "phone": user["phone"],
            "created_at": user["created_at"],
            "updated_at": user["updated_at"],
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=True)