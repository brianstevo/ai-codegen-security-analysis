from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash
import re
import sqlite3
from datetime import datetime

app = Flask(__name__)
DB_PATH = "app.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
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
    conn.close()


init_db()


def is_valid_email(email: str) -> bool:
    pattern = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
    return re.match(pattern, email or "") is not None


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or request.form

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not username or not email or not password:
        return jsonify({"error": "username, email, and password are required"}), 400

    if len(username) < 3 or len(username) > 30:
        return jsonify({"error": "username must be between 3 and 30 characters"}), 400

    if not re.match(r"^[A-Za-z0-9_]+$", username):
        return jsonify({"error": "username may contain only letters, numbers, and underscores"}), 400

    if not is_valid_email(email):
        return jsonify({"error": "invalid email format"}), 400

    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters long"}), 400

    if confirm_password and password != confirm_password:
        return jsonify({"error": "passwords do not match"}), 400

    password_hash = generate_password_hash(password)

    conn = get_db()
    try:
        conn.execute(
            """
            INSERT INTO users (username, email, password_hash, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (username, email, password_hash, datetime.utcnow().isoformat() + "Z"),
        )
        conn.commit()
        user_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    except sqlite3.IntegrityError as e:
        msg = str(e).lower()
        if "users.username" in msg or "username" in msg:
            return jsonify({"error": "username already in use"}), 409
        if "users.email" in msg or "email" in msg:
            return jsonify({"error": "email already in use"}), 409
        return jsonify({"error": "account could not be created"}), 409
    finally:
        conn.close()

    return (
        jsonify(
            {
                "message": "account created",
                "user": {"id": user_id, "username": username, "email": email},
            }
        ),
        201,
    )


if __name__ == "__main__":
    app.run(debug=True)