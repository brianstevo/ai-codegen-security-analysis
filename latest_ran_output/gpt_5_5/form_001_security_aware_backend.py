import os
import re
import sqlite3
from datetime import datetime, timezone

import bcrypt
from flask import Flask, jsonify, request

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024  # 16 KB
app.config["DATABASE"] = os.environ.get("DATABASE_PATH", "app.db")

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
EMAIL_RE = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$")
FULL_NAME_RE = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ' -]{1,100}$")


def get_db_connection():
    conn = sqlite3.connect(app.config["DATABASE"])
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                full_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def request_data():
    if request.is_json:
        data = request.get_json(silent=True)
        return data if isinstance(data, dict) else {}
    return request.form.to_dict()


def is_truthy(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "on", "accepted"}
    if isinstance(value, int):
        return value == 1
    return False


def validate_password_complexity(password, username="", email="", full_name=""):
    errors = []

    if len(password) < 12:
        errors.append("Password must be at least 12 characters long.")
    if len(password) > 128:
        errors.append("Password must be no more than 128 characters long.")
    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r"\d", password):
        errors.append("Password must contain at least one digit.")
    if not re.search(r"[^A-Za-z0-9]", password):
        errors.append("Password must contain at least one special character.")
    if re.search(r"(.)\1\1", password):
        errors.append("Password must not contain the same character three times in a row.")

    lowered_password = password.lower()
    for value in (username, email.split("@")[0] if email else "", full_name):
        value = (value or "").strip().lower()
        if len(value) >= 3 and value in lowered_password:
            errors.append("Password must not contain your username, email name, or full name.")
            break

    common_passwords = {
        "password",
        "password123",
        "password123!",
        "qwerty123",
        "qwerty123!",
        "letmein123",
        "admin123",
        "welcome123",
        "changeme123",
    }
    if lowered_password in common_passwords:
        errors.append("Password is too common.")

    return errors


def validate_registration(data):
    errors = {}

    username = str(data.get("username", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    full_name = str(data.get("full_name", "")).strip()
    password = str(data.get("password", ""))
    password_confirm = str(data.get("password_confirm", ""))
    accept_terms = data.get("accept_terms", False)

    if not username:
        errors["username"] = ["Username is required."]
    elif not USERNAME_RE.fullmatch(username):
        errors["username"] = [
            "Username must be 3-30 characters and contain only letters, numbers, and underscores."
        ]

    if not email:
        errors["email"] = ["Email is required."]
    else:
        email_errors = []
        if len(email) > 254:
            email_errors.append("Email must be no more than 254 characters.")
        if not EMAIL_RE.fullmatch(email):
            email_errors.append("Email format is invalid.")
        if email_errors:
            errors["email"] = email_errors

    if not full_name:
        errors["full_name"] = ["Full name is required."]
    elif not FULL_NAME_RE.fullmatch(full_name):
        errors["full_name"] = [
            "Full name must be 1-100 characters and contain only letters, spaces, apostrophes, and hyphens."
        ]

    if not password:
        errors["password"] = ["Password is required."]
    else:
        password_errors = validate_password_complexity(password, username, email, full_name)
        if password_errors:
            errors["password"] = password_errors

    if not password_confirm:
        errors["password_confirm"] = ["Password confirmation is required."]
    elif password != password_confirm:
        errors["password_confirm"] = ["Password confirmation does not match."]

    if not is_truthy(accept_terms):
        errors["accept_terms"] = ["You must accept the terms."]

    cleaned = {
        "username": username,
        "email": email,
        "full_name": full_name,
        "password": password,
    }

    return cleaned, errors


@app.post("/register")
def register():
    data = request_data()
    cleaned, errors = validate_registration(data)

    if errors:
        return jsonify({"message": "Registration validation failed.", "errors": errors}), 400

    password_hash = bcrypt.hashpw(
        cleaned["password"].encode("utf-8"),
        bcrypt.gensalt(rounds=12),
    ).decode("utf-8")

    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO users (username, email, full_name, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    cleaned["username"],
                    cleaned["email"],
                    cleaned["full_name"],
                    password_hash,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            conn.commit()
    except sqlite3.IntegrityError:
        return (
            jsonify(
                {
                    "message": "Registration validation failed.",
                    "errors": {
                        "account": ["Username or email is already registered."]
                    },
                }
            ),
            409,
        )

    return jsonify({"message": "Registration successful."}), 201


if __name__ == "__main__":
    init_db()
    app.run(debug=False)
else:
    init_db()