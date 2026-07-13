import os
import re
import sqlite3
from typing import Dict, Any, Tuple

import bcrypt
from email_validator import validate_email, EmailNotValidError
from flask import Flask, request, jsonify, g


app = Flask(__name__)
app.config["DATABASE"] = os.environ.get("DATABASE_PATH", "app.sqlite3")

USERNAME_RE = re.compile(r"^[A-Za-z0-9]{3,30}$")
PASSWORD_MAX_LENGTH = 128

COMMON_PASSWORDS = {
    "password",
    "password1",
    "password123",
    "12345678",
    "123456789",
    "qwerty123",
    "admin123",
    "letmein123",
    "welcome123",
}


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_: BaseException | None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    with app.app_context():
        db = get_db()
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        db.commit()


def request_data() -> Dict[str, Any]:
    if request.is_json:
        data = request.get_json(silent=True)
        return data if isinstance(data, dict) else {}
    return request.form.to_dict()


def validate_registration(data: Dict[str, Any]) -> Tuple[Dict[str, str], Dict[str, str]]:
    errors: Dict[str, str] = {}
    cleaned: Dict[str, str] = {}

    username = str(data.get("username", "")).strip()
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", ""))
    confirm_password = str(data.get("confirm_password", ""))

    if not username:
        errors["username"] = "Username is required."
    elif not USERNAME_RE.fullmatch(username):
        errors["username"] = "Username must be 3-30 characters and contain only letters and numbers."
    else:
        cleaned["username"] = username

    if not email:
        errors["email"] = "Email address is required."
    else:
        try:
            valid_email = validate_email(
                email,
                check_deliverability=False,
                allow_smtputf8=False,
            )
            cleaned["email"] = valid_email.normalized.lower()
        except EmailNotValidError:
            errors["email"] = "Enter a valid email address."

    if not password:
        errors["password"] = "Password is required."
    else:
        password_errors = []

        if len(password) < 12:
            password_errors.append("be at least 12 characters long")
        if len(password) > PASSWORD_MAX_LENGTH:
            password_errors.append(f"be no more than {PASSWORD_MAX_LENGTH} characters long")
        if re.search(r"\s", password):
            password_errors.append("not contain spaces")
        if not re.search(r"[a-z]", password):
            password_errors.append("include a lowercase letter")
        if not re.search(r"[A-Z]", password):
            password_errors.append("include an uppercase letter")
        if not re.search(r"\d", password):
            password_errors.append("include a number")
        if not re.search(r"[^A-Za-z0-9\s]", password):
            password_errors.append("include a symbol")
        if password.lower() in COMMON_PASSWORDS:
            password_errors.append("not be a commonly used password")

        username_value = cleaned.get("username", username).lower()
        email_value = cleaned.get("email", email).lower()
        email_local_part = email_value.split("@", 1)[0] if "@" in email_value else ""

        if username_value and username_value in password.lower():
            password_errors.append("not contain your username")
        if email_local_part and email_local_part in password.lower():
            password_errors.append("not contain part of your email address")

        if password_errors:
            errors["password"] = "Password must " + ", ".join(password_errors) + "."

    if not confirm_password:
        errors["confirm_password"] = "Password confirmation is required."
    elif password and password != confirm_password:
        errors["confirm_password"] = "Password confirmation does not match."

    return errors, cleaned


@app.post("/register")
def register():
    data = request_data()
    errors, cleaned = validate_registration(data)

    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    password = str(data["password"])
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

    db = get_db()

    try:
        db.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (cleaned["username"], cleaned["email"], password_hash),
        )
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        return (
            jsonify(
                {
                    "ok": False,
                    "errors": {
                        "registration": "Registration could not be completed with the provided details."
                    },
                }
            ),
            400,
        )

    return jsonify({"ok": True, "message": "Account created."}), 201


if __name__ == "__main__":
    init_db()
    app.run(debug=False)