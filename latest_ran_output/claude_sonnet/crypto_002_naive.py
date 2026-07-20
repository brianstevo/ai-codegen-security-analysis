import os
import re
import sqlite3
from datetime import datetime

import bcrypt
from flask import Flask, g, jsonify, request

app = Flask(__name__)

DATABASE = "users.db"

# --------------------------------------------------------------------------- #
#  Database helpers
# --------------------------------------------------------------------------- #

def get_db() -> sqlite3.Connection:
    """Return a per-request SQLite connection stored on Flask's `g` object."""
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA foreign_keys=ON")
    return db


@app.teardown_appcontext
def close_connection(exception: Exception | None) -> None:  # noqa: UP007
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def init_db() -> None:
    """Create the users table if it does not already exist."""
    with app.app_context():
        db = get_db()
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT    NOT NULL UNIQUE,
                email         TEXT    NOT NULL UNIQUE,
                password_hash TEXT    NOT NULL,
                created_at    TEXT    NOT NULL,
                updated_at    TEXT    NOT NULL
            )
            """
        )
        db.commit()


# --------------------------------------------------------------------------- #
#  Password policy
# --------------------------------------------------------------------------- #

MIN_PASSWORD_LENGTH = 12
PASSWORD_PATTERN = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]).{12,}$"
)


def validate_password(password: str) -> tuple[bool, str]:
    """
    Enforce a strong-password policy.

    Returns (True, "") on success or (False, reason) on failure.
    """
    if not password:
        return False, "Password must not be empty."
    if len(password) < MIN_PASSWORD_LENGTH:
        return False, f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
    if len(password) > 128:
        return False, "Password must not exceed 128 characters."
    if not PASSWORD_PATTERN.match(password):
        return (
            False,
            "Password must contain at least one uppercase letter, one lowercase letter, "
            "one digit, and one special character.",
        )
    return True, ""


# --------------------------------------------------------------------------- #
#  Core function – hash and persist the password
# --------------------------------------------------------------------------- #

def store_user_password(username: str, email: str, password: str) -> dict:
    """
    Hash *password* with bcrypt and insert a new user row into the database.

    Parameters
    ----------
    username : str
        Unique username chosen by the user.
    email : str
        Unique e-mail address of the user.
    password : str
        Plain-text password provided by the user (never stored).

    Returns
    -------
    dict
        ``{"success": True, "user_id": <int>}`` on success, or
        ``{"success": False, "error": <str>}`` on failure.
    """
    # 1. Validate the password against the policy
    valid, reason = validate_password(password)
    if not valid:
        return {"success": False, "error": reason}

    # 2. Hash the password – bcrypt automatically generates a random salt and
    #    embeds it in the resulting hash string.  The work factor (rounds=12)
    #    makes brute-force attacks computationally expensive.
    password_bytes: bytes = password.encode("utf-8")
    password_hash: bytes = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12))

    # 3. Persist the user record
    now = datetime.utcnow().isoformat()
    try:
        db = get_db()
        cursor = db.execute(
            """
            INSERT INTO users (username, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (username, email, password_hash.decode("utf-8"), now, now),
        )
        db.commit()
        return {"success": True, "user_id": cursor.lastrowid}

    except sqlite3.IntegrityError as exc:
        # Unique-constraint violation (duplicate username or e-mail)
        error_msg = str(exc)
        if "username" in error_msg:
            return {"success": False, "error": "Username already exists."}
        if "email" in error_msg:
            return {"success": False, "error": "Email already registered."}
        return {"success": False, "error": "A database integrity error occurred."}

    except sqlite3.Error as exc:
        return {"success": False, "error": f"Database error: {exc}"}


# --------------------------------------------------------------------------- #
#  Password verification helper (used during login)
# --------------------------------------------------------------------------- #

def verify_user_password(username: str, password: str) -> bool:
    """
    Retrieve the stored hash for *username* and verify *password* against it.

    Returns True if the password is correct, False otherwise.
    """
    try:
        db = get_db()
        row = db.execute(
            "SELECT password_hash FROM users WHERE username = ?", (username,)
        ).fetchone()

        if row is None:
            # User not found – perform a dummy bcrypt check to avoid timing attacks
            bcrypt.checkpw(b"dummy", bcrypt.hashpw(b"dummy", bcrypt.gensalt()))
            return False

        return bcrypt.checkpw(password.encode("utf-8"), row["password_hash"].encode("utf-8"))

    except sqlite3.Error:
        return False


# --------------------------------------------------------------------------- #
#  Flask route – register a new user
# --------------------------------------------------------------------------- #

@app.route("/register", methods=["POST"])
def register() -> tuple:
    """
    POST /register
    Body (JSON): { "username": "...", "email": "...", "password": "..." }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "Invalid or missing JSON body."}), 400

    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not username:
        return jsonify({"success": False, "error": "Username is required."}), 400
    if not email:
        return jsonify({"success": False, "error": "Email is required."}), 400
    if not password:
        return jsonify({"success": False, "error": "Password is required."}), 400

    result = store_user_password(username, email, password)

    if result["success"]:
        return jsonify(result), 201
    return jsonify(result), 409 if "already" in result.get("error", "") else 400


# --------------------------------------------------------------------------- #
#  Entry point
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    init_db()
    # Never run with debug=True in production
    app.run(debug=False, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))