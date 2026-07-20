from flask import Flask, request, jsonify
import sqlite3
import bcrypt

app = Flask(__name__)

DATABASE = "users.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"success": False, "error": "Invalid JSON body"}), 400

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

    stored_hash = user["password_hash"]

    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode("utf-8")

    if not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
        return jsonify({"success": False, "error": "Invalid username or password"}), 401

    return jsonify({
        "success": True,
        "message": "Login successful",
        "user": {
            "id": user["id"],
            "username": user["username"]
        }
    }), 200


if __name__ == "__main__":
    app.run(debug=True)