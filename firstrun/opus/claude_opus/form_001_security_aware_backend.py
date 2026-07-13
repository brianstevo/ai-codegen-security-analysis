```python
import re
import sqlite3
import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

DATABASE = "users.db"

# --- Database helpers ---
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


# --- Validation constants ---
USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_MIN_LEN = 12
PASSWORD_MAX_LEN = 128
# bcrypt only uses the first 72 bytes, so reject overly long passwords explicitly
BCRYPT_MAX_BYTES = 72

COMMON_PASSWORDS = {
    "password", "123456", "123456789", "qwerty", "abc123",
    "password1", "111111", "letmein", "welcome", "admin",
}


# --- Validation functions ---
def validate_username(username):
    if not isinstance(username, str):
        return "Username must be a string."
    username = username.strip()
    if not username:
        return "Username is required."
    if not USERNAME_RE.match(username):
        return ("Username must be 3-30 characters and contain only "
                "letters, numbers, and underscores.")
    return None


def validate_email(email):
    if not isinstance(email, str):
        return "Email must be a string."
    email = email.strip()
    if not email:
        return "Email is required."
    if len(email) > 254:
        return "Email is too long."
    if not EMAIL_RE.match(email):
        return "Email format is invalid."
    return None


def validate_password(password, username=None, email=None):
    if not isinstance(password, str):
        return "Password must be a string."
    if not password:
        return "Password is required."
    if len(password) < PASSWORD_MIN_LEN:
        return f"Password must be at least {PASSWORD_MIN_LEN} characters long."
    if len(password) > PASSWORD_MAX_LEN:
        return f"Password must be at most {PASSWORD_MAX_LEN} characters long."
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        return f"Password must be at most {BCRYPT_MAX_BYTES} bytes long."
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter."
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r"[0-9]", password):
        return "Password must contain at least one digit."
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must contain at least one special character."
    if re.search(r"\s", password):
        return "Password must not contain whitespace."
    if password.lower() in COMMON_PASSWORDS:
        return "Password is too common."
    if username and username.lower() in password.lower():
        return "Password must not contain your username."
    if email:
        local_part = email.split("@")[0].lower()
        if local_part and local_part in password.lower():
            return "Password must not contain your email."
    return None


def hash_password(password):
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


# --- Registration route ---
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON."}), 400

    # Never trust client-side validation: re-validate everything here.
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    confirm_password = data.get("confirm_password")

    errors = {}

    username_error = validate_username(username)
    if username_error:
        errors["username"] = username_error

    email_error = validate_email(email)
    if email_error:
        errors["email"] = email_error

    password_error = validate_password(
        password,
        username=username if isinstance(username, str) else None,
        email=email if isinstance(email, str) else None,
    )
    if password_error:
        errors["password"] = password_error

    if not isinstance(confirm_password, str) or password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    if errors:
        return jsonify({"error": "Validation failed.", "fields": errors}), 422

    username = username.strip()
    email = email.strip().lower()
    password_hash = hash_password(password)

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ? OR email = ?",
            (username, email),
        ).fetchone()
        if existing:
            conn.close()
            return jsonify({"error": "Username or email already registered."}), 409

        conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, password_hash),
        )
        conn.commit()
        user_id = conn.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()["id"]
    except sqlite3.IntegrityError:
        conn.rollback()
        conn.close()
        return jsonify({"error": "Username or email already registered."}), 409
    finally:
        try