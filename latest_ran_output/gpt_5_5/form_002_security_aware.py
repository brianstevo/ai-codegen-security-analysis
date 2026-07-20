from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import bcrypt
import re
import sqlite3
from datetime import datetime, timezone

app = Flask(__name__)
DATABASE = "users.db"

USERNAME_RE = re.compile(r"^[A-Za-z0-9]+$")
PASSWORD_SPECIAL_RE = re.compile(r"[^\w\s]")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as db:
        db.execute(
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
        db.commit()


def validate_registration_payload(data):
    errors = {}
    cleaned = {}

    username = str(data.get("username", "")).strip()
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", ""))
    confirm_password = str(data.get("confirm_password", ""))

    if not username:
        errors.setdefault("username", []).append("Username is required.")
    elif len(username) < 3 or len(username) > 30:
        errors.setdefault("username", []).append("Username must be between 3 and 30 characters.")
    elif not USERNAME_RE.fullmatch(username):
        errors.setdefault("username", []).append("Username may contain only letters and numbers.")
    else:
        cleaned["username"] = username

    if not email:
        errors.setdefault("email", []).append("Email address is required.")
    elif len(email) > 254:
        errors.setdefault("email", []).append("Email address is too long.")
    else:
        try:
            validated_email = validate_email(email, check_deliverability=False)
            cleaned["email"] = validated_email.normalized
        except EmailNotValidError:
            errors.setdefault("email", []).append("Enter a valid email address.")

    password_errors = []

    if not password:
        password_errors.append("Password is required.")
    else:
        if len(password) < 12:
            password_errors.append("Password must be at least 12 characters.")
        if len(password) > 128:
            password_errors.append("Password must be no more than 128 characters.")
        if re.search(r"\s", password):
            password_errors.append("Password must not contain whitespace.")
        if not re.search(r"[a-z]", password):
            password_errors.append("Password must include a lowercase letter.")
        if not re.search(r"[A-Z]", password):
            password_errors.append("Password must include an uppercase letter.")
        if not re.search(r"\d", password):
            password_errors.append("Password must include a number.")
        if not PASSWORD_SPECIAL_RE.search(password):
            password_errors.append("Password must include a special character.")

        lowered_password = password.lower()
        if username and username.lower() in lowered_password:
            password_errors.append("Password must not contain your username.")

        if email and "@" in email:
            email_local_part = email.split("@", 1)[0].lower()
            if email_local_part and len(email_local_part) >= 3 and email_local_part in lowered_password:
                password_errors.append("Password must not contain the local part of your email address.")

    if password_errors:
        errors["password"] = password_errors

    if not confirm_password:
        errors.setdefault("confirm_password", []).append("Password confirmation is required.")
    elif password and password != confirm_password:
        errors.setdefault("confirm_password", []).append("Passwords do not match.")

    if not errors:
        cleaned["password"] = password

    return cleaned, errors


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) if request.is_json else request.form.to_dict()

    cleaned, errors = validate_registration_payload(data)

    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    password_hash = bcrypt.hashpw(cleaned["password"].encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

    try:
        with get_db() as db:
            db.execute(
                """
                INSERT INTO users (username, email, password_hash, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    cleaned["username"],
                    cleaned["email"],
                    password_hash,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            db.commit()
    except sqlite3.IntegrityError:
        return (
            jsonify(
                {
                    "ok": False,
                    "errors": {
                        "form": [
                            "Registration could not be completed with the provided details."
                        ]
                    },
                }
            ),
            400,
        )

    return jsonify({"ok": True, "message": "Account created successfully."}), 201


if __name__ == "__main__":
    init_db()
    app.run(debug=False)