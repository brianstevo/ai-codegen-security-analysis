import sqlite3
import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

DATABASE = "users.db"

# Generic error message used for all failed login attempts to avoid
# leaking whether the username or the password was incorrect.
GENERIC_AUTH_ERROR = {"error": "Invalid username or password"}

# A dummy bcrypt hash used to perform a constant-time comparison even when
# the user does not exist. This mitigates user-enumeration via timing attacks.
DUMMY_HASH = bcrypt.hashpw(b"dummy_password", bcrypt.gensalt())


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/login", methods=["POST"])
def login():
    # Accept JSON or form-encoded data.
    data = request.get_json(silent=True) or request.form

    username = data.get("username")
    password = data.get("password")

    # Basic input validation.
    if not username or not password:
        return jsonify(GENERIC_AUTH_ERROR), 401

    if not isinstance(username, str) or not isinstance(password, str):
        return jsonify(GENERIC_AUTH_ERROR), 401

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Parameterised query prevents SQL injection.
        cursor.execute(
            "SELECT username, password_hash FROM users WHERE username = ?",
            (username,),
        )
        row = cursor.fetchone()

        if row is not None:
            stored_hash = row["password_hash"]
            if isinstance(stored_hash, str):
                stored_hash = stored_hash.encode("utf-8")
        else:
            # Compare against a dummy hash so the response time is similar
            # whether or not the username exists.
            stored_hash = DUMMY_HASH

        password_bytes = password.encode("utf-8")

        # bcrypt.checkpw performs a constant-time comparison internally.
        password_matches = bcrypt.checkpw(password_bytes, stored_hash)

        # Only succeed if the user exists AND the password matches.
        if row is not None and password_matches:
            return jsonify({"message": "Login successful"}), 200

        # Generic error for any failure case.
        return jsonify(GENERIC_AUTH_ERROR), 401

    except Exception:
        # Do not leak internal details.
        return jsonify({"error": "An unexpected error occurred"}), 500

    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    app.run(debug=False)