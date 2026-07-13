import re
import sqlite3
from datetime import datetime, timezone

import bcrypt
from flask import Flask, jsonify, request

app = Flask(__name__)
DATABASE = "app.db"

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
EMAIL_RE = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$")

COMMON_PASSWORDS = {
    "password",
    "password123",
    "12345678",
    "123456789",
    "qwerty123",
    "admin123",
    "letmein123",
    "welcome123",
    "iloveyou",
}


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_password(password: str, username: str, email: str) -> list[str]:
    errors = []

    if not isinstance(password, str):
        return ["Password is required."]

    if len(password) < 12:
        errors.append("Password must be at least 12 characters long.")

    if len(password) > 128:
        errors.append("Password must be no more than 128 characters long.")

    if re.search(r"\s", password):
        errors.append("Password must not contain whitespace.")

    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")

    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")

    if not re.search(r"\d", password):
        errors.append("Password must contain at least one number.")

    if not re.search(r"[^A-Za-z0-9]", password):
        errors.append("Password must contain at least one special character.")

    lower_password = password.lower()

    if lower_password in COMMON_PASSWORDS:
        errors.append("Password is too common.")

    if username and username.lower() in lower_password:
        errors.append("Password must not contain your username.")

    email_local_part = email.split("@", 1)[0].lower() if email and "@" in email else ""
    if email_local_part and len(email_local_part) >= 3 and email_local_part in lower_password:
        errors.append("Password must not contain part of your email address.")

    return errors


def validate_registration_payload(data: dict) -> tuple[dict, dict]:
    errors = {}

    allowed_fields = {"username", "email", "password", "confirm_password"}
    required_fields = {"username", "email", "password", "confirm_password"}

    if not isinstance(data, dict):
        return {}, {"request": ["Request body must be a JSON object."]}

    unknown_fields = set(data.keys()) - allowed_fields
    if unknown_fields:
        errors["fields"] = [f"Unknown field: {field}" for field in sorted(unknown_fields)]

    missing_fields = required_fields - set(data.keys())
    for field in sorted(missing_fields):
        errors.setdefault(field, []).append("This field is required.")

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    confirm_password = data.get("confirm_password")

    if username is not None:
        if not isinstance(username, str):
            errors.setdefault("username", []).append("Username must be a string.")
        else:
            username = username.strip()
            if not USERNAME_RE.fullmatch(username):
                errors.setdefault("username", []).append(
                    "Username must be 3-30 characters and contain only letters, numbers, and underscores."
                )

    if email is not None:
        if not isinstance(email, str):
            errors.setdefault("email", []).append("Email must be a string.")
        else:
            email = normalize_email(email)
            if len(email) > 254:
                errors.setdefault("email", []).append("Email must be no more than 254 characters.")
            elif not EMAIL_RE.fullmatch(email):
                errors.setdefault("email", []).append("Enter a valid email address.")

    if password is not None:
        errors_for_password = validate_password(
            password=password,
            username=username if isinstance(username, str) else "",
            email=email if isinstance(email, str) else "",
        )
        if errors_for_password:
            errors.setdefault("password", []).extend(errors_for_password)

    if confirm_password is not None:
        if not isinstance(confirm_password, str):
            errors.setdefault("confirm_password", []).append("Confirm password must be a string.")
        elif isinstance(password, str) and password != confirm_password:
            errors.setdefault("confirm_password", []).append("Passwords do not match.")

    cleaned = {
        "username": username,
        "email": email,
        "password": password,
    }

    return cleaned, errors


@app.post("/register")
def register():
    data = request.get_json(silent=True)

    cleaned, errors = validate_registration_payload(data)
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    username = cleaned["username"]
    email = cleaned["email"]
    password = cleaned["password"]

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(rounds=12),
    ).decode("utf-8")

    created_at = datetime.now(timezone.utc).isoformat()

    try:
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO users (username, email, password_hash, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (username, email, password_hash, created_at),
            )
            conn.commit()

    except sqlite3.IntegrityError:
        with get_db() as conn:
            existing_username = conn.execute(
                "SELECT 1 FROM users WHERE username = ? LIMIT 1",
                (username,),
            ).fetchone()
            existing_email = conn.execute(
                "SELECT 1 FROM users WHERE email = ? LIMIT 1",
                (email,),
            ).fetchone()

        conflict_errors = {}
        if existing_username:
            conflict_errors.setdefault("username", []).append("Username is already taken.")
        if existing_email:
            conflict_errors.setdefault("email", []).append("Email is already registered.")

        return jsonify({"ok": False, "errors": conflict_errors or {"account": ["Registration failed."]}}), 409

    return jsonify({"ok": True, "message": "Registration successful."}), 201


if __name__ == "__main__":
    init_db()
    app.run(debug=False)