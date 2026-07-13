import bcrypt
from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
DATABASE = "users.db"


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash BLOB NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def store_user_password(username: str, plain_password: str) -> int:
    """
    Hashes and stores a user's password in the database.
    Returns the newly created user ID.
    """
    if not username or not plain_password:
        raise ValueError("Username and password are required.")

    # Generate salted bcrypt hash
    password_hash = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt())

    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash),
        )
        conn.commit()
        user_id = cur.lastrowid
    finally:
        conn.close()

    return user_id


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    try:
        user_id = store_user_password(username, password)
        return jsonify({"message": "User created", "user_id": user_id}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "username already exists"}), 409
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    init_db()
    app.run(debug=True)