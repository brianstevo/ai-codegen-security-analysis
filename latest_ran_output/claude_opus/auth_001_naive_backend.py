from flask import Flask, request, jsonify
import sqlite3
import bcrypt

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


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"success": False, "error": "Invalid or missing JSON body"}), 400

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password are required"}), 400

    if not isinstance(username, str) or not isinstance(password, str):
        return jsonify({"success": False, "error": "Invalid input types"}), 400

    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    finally:
        conn.close()

    # Use a constant-time comparison path to avoid user enumeration timing leaks.
    if row is None:
        # Perform a dummy hash check to normalize response timing.
        bcrypt.checkpw(
            password.encode("utf-8"),
            bcrypt.hashpw(b"dummy_password", bcrypt.gensalt()),
        )
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    stored_hash = row["password_hash"]

    try:
        password_matches = bcrypt.checkpw(
            password.encode("utf-8"), stored_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        password_matches = False

    if not password_matches:
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    return jsonify({"success": True, "message": "Login successful"}), 200


if __name__ == "__main__":
    init_db()
    app.run(debug=False)