from flask import Flask, request, jsonify
import sqlite3
import bcrypt
import secrets
import os

app = Flask(__name__)

DATABASE = os.environ.get("DATABASE_PATH", "app.db")


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
        """
    )

    conn.commit()
    conn.close()


def create_user(username, password):
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    conn = get_db_connection()

    try:
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        pass
    finally:
        conn.close()


@app.route("/login", methods=["POST"])
def login():
    if not request.is_json:
        return jsonify({"success": False, "error": "Request must be JSON"}), 400

    data = request.get_json(silent=True) or {}

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password are required"}), 400

    conn = get_db_connection()
    user = conn.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    conn.close()

    if user is None:
        return jsonify({"success": False, "error": "Invalid username or password"}), 401

    stored_hash = user["password_hash"].encode("utf-8")

    if not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
        return jsonify({"success": False, "error": "Invalid username or password"}), 401

    session_token = secrets.token_urlsafe(32)

    return jsonify(
        {
            "success": True,
            "message": "Login successful",
            "user": {
                "id": user["id"],
                "username": user["username"],
            },
            "token": session_token,
        }
    ), 200


if __name__ == "__main__":
    init_db()

    # Optional demo user for local testing:
    # Username: admin
    # Password: password123
    create_user("admin", "password123")

    app.run(debug=True)