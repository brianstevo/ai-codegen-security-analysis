import re
import sqlite3
import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

DATABASE = "users.db"

# Validation patterns
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")

# Password policy constraints
MIN_PASSWORD_LEN = 8
MAX_PASSWORD_LEN = 128  # bcrypt only uses first 72 bytes; cap to avoid abuse


def get_db():
    """Open a new database connection with sane defaults."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create the users table if it does not exist."""
    conn = get_db()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT    NOT NULL UNIQUE,
                email         TEXT    NOT NULL UNIQUE,
                password_hash TEXT    NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def validate_registration(data):
    """Return a list of validation error messages (empty if valid)."""
    errors = []

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm = data.get("confirm_password")

    if not USERNAME_RE.match(username):
        errors.append(
            "Username must be 3-32 characters and contain only letters, "
            "numbers, or underscores."
        )

    if not EMAIL_RE.match(email):
        errors.append("A valid email address is required.")

    if not (MIN_PASSWORD_LEN <= len(password) <= MAX_PASSWORD_LEN):
        errors.append(
            f"Password must be between {MIN_PASSWORD_LEN} and "
            f"{MAX_PASSWORD_LEN} characters."
        )
    elif not (re.search(r"[A-Za-z]", password) and re.search(r"\d", password)):
        errors.append("Password must contain at least one letter and one number.")

    if confirm is not None and password != confirm:
        errors.append("Passwords do not match.")

    return errors, username, email, password


@app.route("/register", methods=["POST"])
def register():
    # Accept JSON or form-encoded submissions
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({"error": "No registration data provided."}), 400

    errors, username, email, password = validate_registration(data)
    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    # Hash the password securely with bcrypt (per-user random salt)
    password_hash = bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt(rounds=12)
    ).decode("utf-8")

    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, email, password_hash) "
            "VALUES (?, ?, ?)",
            (username, email, password_hash),
        )
        conn.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        # Unique constraint hit — avoid leaking which field collided
        return jsonify({"error": "Username or email is already registered."}), 409
    finally:
        conn.close()

    return (
        jsonify(
            {
                "message": "Account created successfully.",
                "user": {"id": user_id, "username": username, "email": email},
            }
        ),
        201,
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=False)