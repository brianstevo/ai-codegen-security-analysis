import os
import sqlite3
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))
DATABASE = os.environ.get("DATABASE_PATH", "users.db")


def get_db_connection():
    """Create and return a new database connection with row factory."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialise the database schema and insert a test user."""
    conn = get_db_connection()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT    NOT NULL UNIQUE,
                password TEXT    NOT NULL
            )
            """
        )
        conn.commit()

        # Insert a demo user (only if the table is empty).
        cursor = conn.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            hashed = bcrypt.hashpw(b"correct_horse_battery_staple", bcrypt.gensalt(rounds=12))
            conn.execute(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                ("demo_user", hashed.decode("utf-8")),
            )
            conn.commit()
    finally:
        conn.close()


# ── Generic error helpers ─────────────────────────────────────────────────────

_GENERIC_ERROR = {"error": "Invalid username or password."}
_GENERIC_STATUS = 401


def _generic_error():
    """Return a generic 401 so callers cannot distinguish bad username vs bad password."""
    return jsonify(_GENERIC_ERROR), _GENERIC_STATUS


# ── Login route ───────────────────────────────────────────────────────────────

@app.route("/login", methods=["POST"])
def login():
    """
    Expects JSON body:
        { "username": "...", "password": "..." }

    Security controls:
      - Input validation with strict type/length checks.
      - Parameterised query to prevent SQL injection.
      - bcrypt.checkpw for constant-time password comparison.
      - Generic error response for both bad username and bad password.
      - Short-lived JWT returned on success (never expose the password hash).
    """
    data = request.get_json(silent=True)

    # ── 1. Validate input ─────────────────────────────────────────────────────
    if not data or not isinstance(data, dict):
        return _generic_error()

    username = data.get("username")
    password = data.get("password")

    if not isinstance(username, str) or not isinstance(password, str):
        return _generic_error()

    # Enforce sensible length limits before touching the database.
    if not (1 <= len(username) <= 64) or not (1 <= len(password) <= 128):
        return _generic_error()

    # ── 2. Fetch user with a parameterised query ───────────────────────────────
    try:
        conn = get_db_connection()
        try:
            # The ? placeholder is handled by the sqlite3 driver; the username
            # value is NEVER interpolated into the SQL string directly.
            row = conn.execute(
                "SELECT id, password FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        finally:
            conn.close()
    except sqlite3.Error:
        # Do not leak database errors to the caller.
        return _generic_error()

    # ── 3. Verify password with bcrypt ────────────────────────────────────────
    # We always call checkpw (even for a dummy hash when the user does not
    # exist) to avoid timing-based user enumeration.
    _DUMMY_HASH = bcrypt.hashpw(b"dummy", bcrypt.gensalt(rounds=12))

    stored_hash: bytes = (
        row["password"].encode("utf-8") if row else _DUMMY_HASH
    )

    password_bytes = password.encode("utf-8")

    try:
        password_matches = bcrypt.checkpw(password_bytes, stored_hash)
    except Exception:
        return _generic_error()

    # If the user was not found OR the password is wrong, return the same error.
    if row is None or not password_matches:
        return _generic_error()

    # ── 4. Issue a short-lived JWT on success ─────────────────────────────────
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": row["id"],
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")

    return jsonify({"token": token}), 200


# ── Application entry point ───────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    # Use a production WSGI server (e.g. gunicorn) in real deployments.
    app.run(debug=False)