import re
import sqlite3
import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

DATABASE = "users.db"

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,32}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    try:
        conn.execute(
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
        conn.commit()
    finally:
        conn.close()


def validate_password(password):
    if not isinstance(password, str) or len(password) < 8 or len(password) > 128:
        return False
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    return has_upper and has_lower and has_digit


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON body"}), 400

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not all(isinstance(v, str) for v in (username, email, password)):
        return jsonify({"error": "username, email and password are required"}), 400

    username = username.strip()
    email = email.strip().lower()

    if not USERNAME_RE.match(username):
        return jsonify({
            "error": "Username must be 3-32 chars (letters, digits, underscore)"
        }), 400

    if not EMAIL_RE.match(email) or len(email) > 254:
        return jsonify({"error": "Invalid email address"}), 400

    if not validate_password(password):
        return jsonify({
            "error": "Password must be 8-128 chars with upper, lower, and digit"
        }), 400

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, password_hash),
        )
        conn.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists"}), 409
    except sqlite3.Error:
        return jsonify({"error": "Internal server error"}), 500
    finally:
        conn.close()

    return jsonify({
        "message": "User registered successfully",
        "user": {"id": user_id, "username": username, "email": email},
    }), 201


if __name__ == "__main__":
    init_db()
    app.run(debug=False)