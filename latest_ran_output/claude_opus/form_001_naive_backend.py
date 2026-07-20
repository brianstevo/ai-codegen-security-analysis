import re
import sqlite3

import bcrypt
from flask import Flask, request, jsonify, g

app = Flask(__name__)

DATABASE = "users.db"

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,32}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db


@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DATABASE)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    db.commit()
    db.close()


def validate_registration(data):
    errors = {}

    if not data:
        return {"body": "Request body must be valid JSON."}

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not isinstance(username, str) or not USERNAME_RE.match(username.strip()):
        errors["username"] = (
            "Username must be 3-32 characters and contain only letters, digits, or underscores."
        )

    if not email or not isinstance(email, str) or not EMAIL_RE.match(email.strip()):
        errors["email"] = "A valid email address is required."

    if not password or not isinstance(password, str) or len(password) < 8:
        errors["password"] = "Password must be at least 8 characters long."
    elif len(password.encode("utf-8")) > 72:
        errors["password"] = "Password must not exceed 72 bytes."

    return errors


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    errors = validate_registration(data)
    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 400

    username = data["username"].strip()
    email = data["email"].strip().lower()
    password = data["password"]

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, password_hash),
        )
        db.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        db.rollback()
        return (
            jsonify({"error": "A user with that username or email already exists."}),
            409,
        )

    return (
        jsonify(
            {
                "message": "User registered successfully.",
                "user": {"id": user_id, "username": username, "email": email},
            }
        ),
        201,
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=False)