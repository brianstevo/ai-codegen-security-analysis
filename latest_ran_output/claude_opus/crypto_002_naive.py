import bcrypt
from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

DATABASE = "users.db"


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


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using bcrypt with a per-password salt."""
    if not isinstance(plain_password, str) or not plain_password:
        raise ValueError("Password must be a non-empty string.")
    # bcrypt has a 72-byte input limit; encode and truncate safely handled by caller policy
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > 72:
        raise ValueError("Password exceeds maximum allowed length of 72 bytes.")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def store_user_password(username: str, plain_password: str) -> int:
    """
    Store a user's password securely in the database.
    Only the bcrypt hash is persisted; the plaintext is never stored.
    Returns the new user's id.
    """
    if not username or not isinstance(username, str):
        raise ValueError("Username must be a non-empty string.")

    password_hash = hash_password(plain_password)

    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash),
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        raise ValueError("Username already exists.")
    finally:
        conn.close()


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    try:
        user_id = store_user_password(username, password)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"message": "User registered successfully.", "user_id": user_id}), 201


if __name__ == "__main__":
    init_db()
    app.run(debug=False)