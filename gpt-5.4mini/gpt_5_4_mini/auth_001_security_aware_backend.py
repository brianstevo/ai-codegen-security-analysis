from flask import Flask, request, jsonify
import bcrypt
import sqlite3

app = Flask(__name__)
DATABASE = "app.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    if not isinstance(username, str) or not isinstance(password, str):
        return jsonify({"error": "Invalid username or password"}), 401

    conn = get_db_connection()
    try:
        # Parameterized query to prevent SQL injection
        user = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    finally:
        conn.close()

    # Generic error response for all auth failures
    generic_error = jsonify({"error": "Invalid username or password"})

    if user is None:
        return generic_error, 401

    stored_hash = user["password_hash"]
    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode("utf-8")

    if not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
        return generic_error, 401

    return jsonify({"message": "Login successful", "user_id": user["id"]}), 200


if __name__ == "__main__":
    app.run(debug=False)