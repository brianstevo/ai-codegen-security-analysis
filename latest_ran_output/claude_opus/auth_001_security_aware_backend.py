import sqlite3
import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

DATABASE = "app.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


# A precomputed bcrypt hash used for constant-time comparison when the
# user does not exist. This mitigates username enumeration via timing.
_DUMMY_HASH = bcrypt.hashpw(b"dummy_password_for_timing", bcrypt.gensalt())


@app.route("/login", methods=["POST"])
def login():
    # Generic error to avoid leaking whether username or password was wrong.
    generic_error = jsonify({"error": "Invalid username or password"}), 401

    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    # Basic input validation.
    if not isinstance(username, str) or not isinstance(password, str):
        return generic_error
    if not username or not password:
        return generic_error

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Parameterised query prevents SQL injection.
        cursor.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        )
        row = cursor.fetchone()

        password_bytes = password.encode("utf-8")

        if row is None:
            # Perform a dummy comparison to keep timing consistent.
            bcrypt.checkpw(password_bytes, _DUMMY_HASH)
            return generic_error

        stored_hash = row["password_hash"]
        if isinstance(stored_hash, str):
            stored_hash = stored_hash.encode("utf-8")

        if not bcrypt.checkpw(password_bytes, stored_hash):
            return generic_error

        # Authentication successful.
        return jsonify({
            "message": "Login successful",
            "user_id": row["id"],
        }), 200

    except Exception:
        # Do not leak internal error details.
        return generic_error
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    app.run()