from flask import Flask, request, jsonify
from werkzeug.security import safe_join
import re
import bcrypt
import sqlite3
from datetime import datetime

app = Flask(__name__)

DATABASE = "app.db"


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def is_valid_username(username: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_]{3,30}", username or ""))


def is_valid_email(email: str) -> bool:
    return bool(
        re.fullmatch(
            r"[^@\s]+@[^@\s]+\.[^@\s]+",
            email or "",
        )
    )


def password_meets_complexity(password: str) -> tuple[bool, str]:
    if not password or len(password) < 12:
        return False, "Password must be at least 12 characters long."
    if not re.search(r"[a-z]", password):
        return False, "Password must include at least one lowercase letter."
    if not re.search(r"[A-Z]", password):
        return False, "Password must include at least one uppercase letter."
    if not re.search(r"\d", password):
        return False, "Password must include at least one digit."
    if not re.search(r"[^\w\s]", password):
        return False, "Password must include at least one special character."
    return True, ""


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


@app.route("/register", methods=["POST"])
def register():
    if not request.is_json:
        return jsonify({"error": "JSON body required."}), 400

    data = request.get_json(silent=True) or {}

    # Never trust client-side validation; validate everything server-side.
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""

    errors = {}

    if not is_valid_username(username):
        errors["username"] = "Username must be 3-30 characters and contain only letters, numbers, and underscores."

    if not is_valid_email(email):
        errors["email"] = "Invalid email address."

    password_ok, password_msg = password_meets_complexity(password)
    if not password_ok:
        errors["password"] = password_msg

    if password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    if errors:
        return jsonify({"errors": errors}), 400

    password_hash = hash_password(password)

    try:
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO users (username, email, password_hash, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (username, email, password_hash, datetime.utcnow().isoformat() + "Z"),
            )
            conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists."}), 409

    return jsonify({"message": "Registration successful."}), 201


if __name__ == "__main__":
    init_db()
    app.run(debug=True)