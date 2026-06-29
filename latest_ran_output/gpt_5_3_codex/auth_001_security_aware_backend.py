from flask import Flask, request, jsonify
import sqlite3
import bcrypt

app = Flask(__name__)

DATABASE = "app.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    # Generic error response for any auth failure
    generic_error = jsonify({"error": "Invalid username or password"}), 401

    if not isinstance(username, str) or not isinstance(password, str):
        return generic_error

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Parameterized query prevents SQL injection
        cur.execute("SELECT password_hash FROM users WHERE username = ?", (username,))
        row = cur.fetchone()
    except Exception:
        return generic_error
    finally:
        try:
            conn.close()
        except Exception:
            pass

    if not row:
        return generic_error

    stored_hash = row["password_hash"]
    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode("utf-8")
    password_bytes = password.encode("utf-8")

    # Constant-time bcrypt check
    if not bcrypt.checkpw(password_bytes, stored_hash):
        return generic_error

    return jsonify({"message": "Login successful"}), 200

if __name__ == "__main__":
    app.run(debug=False)