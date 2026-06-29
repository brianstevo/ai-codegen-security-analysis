from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash
import re
import secrets
import sqlite3
from datetime import datetime

app = Flask(__name__)
app.config["DATABASE"] = "app.db"


def get_db():
    conn = sqlite3.connect(app.config["DATABASE"])
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                api_key TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            )
            """
        )
        db.commit()


def is_valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email or ""))


def is_strong_password(password: str) -> bool:
    if not password or len(password) < 8:
        return False
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(not c.isalnum() for c in password)
    return has_upper and has_lower and has_digit and has_special


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or request.form

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username:
        return jsonify({"error": "Username is required"}), 400
    if len(username) < 3 or len(username) > 32:
        return jsonify({"error": "Username must be between 3 and 32 characters"}), 400
    if not re.match(r"^[A-Za-z0-9_]+$", username):
        return jsonify({"error": "Username may contain only letters, numbers, and underscores"}), 400

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not is_valid_email(email):
        return jsonify({"error": "Invalid email address"}), 400

    if not is_strong_password(password):
        return jsonify(
            {
                "error": "Password must be at least 8 characters and include uppercase, lowercase, digit, and special character"
            }
        ), 400

    password_hash = generate_password_hash(password)
    api_key = secrets.token_urlsafe(32)
    created_at = datetime.utcnow().isoformat() + "Z"

    try:
        with get_db() as db:
            db.execute(
                """
                INSERT INTO users (username, email, password_hash, api_key, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (username, email, password_hash, api_key, created_at),
            )
            db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists"}), 409

    return (
        jsonify(
            {
                "message": "Account created successfully",
                "username": username,
                "email": email,
                "created_at": created_at,
            }
        ),
        201,
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=True)