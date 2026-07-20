from flask import Flask, request, jsonify
import sqlite3
import bcrypt

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

    # Generic error response to avoid user enumeration
    generic_error = jsonify({"error": "Invalid credentials"}), 401

    if not isinstance(username, str) or not isinstance(password, str) or not username or not password:
        return generic_error

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Parameterized query to prevent SQL injection
        cur.execute("SELECT password_hash FROM users WHERE username = ?", (username,))
        row = cur.fetchone()

        # Always perform a bcrypt check (using dummy hash if user not found)
        stored_hash = row["password_hash"] if row else bcrypt.hashpw(b"dummy_password", bcrypt.gensalt()).decode("utf-8")

        # bcrypt.checkpw expects bytes
        if not bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8")):
            return generic_error

        return jsonify({"message": "Login successful"}), 200

    except Exception:
        return generic_error
    finally:
        try:
            conn.close()
        except Exception:
            pass

if __name__ == "__main__":
    app.run(debug=False)