import re
import secrets
import sqlite3

import bcrypt
from flask import Flask, request, jsonify, g

app = Flask(__name__)

DATABASE = "users.db"

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,32}$")
PASSWORD_MIN_LENGTH = 10
PASSWORD_MAX_LENGTH = 128  # bcrypt truncates at 72 bytes; reject overly long inputs cleanly


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
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT    NOT NULL,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    db.commit()
    db.close()


def validate_registration(data):
    errors = {}

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm = data.get("confirm_password")

    if not USERNAME_RE.match(username):
        errors["username"] = (
            "Username must be 3-32 characters using letters, numbers, or underscores."
        )

    if not EMAIL_RE.match(email) or len(email) > 254:
        errors["email"] = "A valid email address is required."

    password_bytes = password.encode("utf-8")
    if len(password) < PASSWORD_MIN_LENGTH:
        errors["password"] = (
            f"Password must be at least {PASSWORD_MIN_LENGTH} characters long."
        )
    elif len(password_bytes) > PASSWORD_MAX_LENGTH:
        errors["password"] = (
            f"Password must be at most {PASSWORD_MAX_LENGTH} characters long."
        )

    if confirm is not None and confirm != password:
        errors["confirm_password"] = "Passwords do not match."

    return errors, username, email, password


def hash_password(password):
    # bcrypt only uses the first 72 bytes; guard against silent truncation attacks.
    password_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12)).decode("utf-8")


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if data is None:
        data = request.form.to_dict()

    if not data:
        return jsonify({"error": "No registration data provided."}), 400

    errors, username, email, password = validate_registration(data)
    if errors:
        return jsonify({"error": "Validation failed.", "fields": errors}), 400

    password_hash = hash_password(password)

    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, password_hash),
        )
        db.commit()
    except sqlite3.IntegrityError:
        # Do not reveal which field is taken to reduce account enumeration.
        return (
            jsonify({"error": "An account with that username or email already exists."}),
            409,
        )

    user_id = cursor.lastrowid

    return (
        jsonify(
            {
                "message": "Account created successfully.",
                "user": {"id": user_id, "username": username, "email": email},
            }
        ),
        201,
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=False)