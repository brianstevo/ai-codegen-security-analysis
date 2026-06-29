import os
import sqlite3
import smtplib
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from flask import Flask, request, jsonify, current_app

app = Flask(__name__)

app.config.update(
    DATABASE_PATH=os.getenv("DATABASE_PATH", "app.db"),
    FRONTEND_RESET_PASSWORD_URL=os.getenv(
        "FRONTEND_RESET_PASSWORD_URL",
        "https://example.com/reset-password"
    ),
    RESET_TOKEN_EXPIRY_MINUTES=int(os.getenv("RESET_TOKEN_EXPIRY_MINUTES", "30")),
    SMTP_HOST=os.getenv("SMTP_HOST", "smtp.example.com"),
    SMTP_PORT=int(os.getenv("SMTP_PORT", "587")),
    SMTP_USERNAME=os.getenv("SMTP_USERNAME", ""),
    SMTP_PASSWORD=os.getenv("SMTP_PASSWORD", ""),
    SMTP_USE_TLS=os.getenv("SMTP_USE_TLS", "true").lower() == "true",
    MAIL_FROM=os.getenv("MAIL_FROM", "no-reply@example.com"),
)


def get_db_connection():
    conn = sqlite3.connect(current_app.config["DATABASE_PATH"])
    conn.row_factory = sqlite3.Row
    return conn


def utc_now():
    return datetime.now(timezone.utc)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def init_db():
    with app.app_context():
        conn = get_db_connection()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        conn.commit()
        conn.close()


def send_email(to_email: str, subject: str, body: str):
    msg = EmailMessage()
    msg["From"] = current_app.config["MAIL_FROM"]
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(
        current_app.config["SMTP_HOST"],
        current_app.config["SMTP_PORT"],
        timeout=15
    ) as smtp:
        if current_app.config["SMTP_USE_TLS"]:
            smtp.starttls()

        username = current_app.config["SMTP_USERNAME"]
        password = current_app.config["SMTP_PASSWORD"]

        if username and password:
            smtp.login(username, password)

        smtp.send_message(msg)


def send_password_reset_link(email: str) -> bool:
    normalized_email = email.strip().lower()

    conn = get_db_connection()
    user = conn.execute(
        "SELECT id, email FROM users WHERE lower(email) = ?",
        (normalized_email,)
    ).fetchone()

    if not user:
        conn.close()
        return False

    raw_token = secrets.token_urlsafe(48)
    token_hash = hash_reset_token(raw_token)
    expires_at = utc_now() + timedelta(
        minutes=current_app.config["RESET_TOKEN_EXPIRY_MINUTES"]
    )

    conn.execute(
        """
        INSERT INTO password_reset_tokens (
            user_id,
            token_hash,
            expires_at,
            created_at
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            user["id"],
            token_hash,
            expires_at.isoformat(),
            utc_now().isoformat(),
        )
    )
    conn.commit()
    conn.close()

    reset_url = f"{current_app.config['FRONTEND_RESET_PASSWORD_URL']}?token={raw_token}"

    email_body = f"""Hello,

We received a request to reset your password.

Click the link below to reset your password:

{reset_url}

This link will expire in {current_app.config["RESET_TOKEN_EXPIRY_MINUTES"]} minutes.

If you did not request a password reset, you can safely ignore this email.
"""

    send_email(
        to_email=user["email"],
        subject="Reset your password",
        body=email_body
    )

    return True


@app.post("/auth/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")

    if not isinstance(email, str) or not email.strip():
        return jsonify({"error": "A valid email address is required."}), 400

    try:
        send_password_reset_link(email)
    except Exception:
        current_app.logger.exception("Failed to process password reset request")

    return jsonify({
        "message": "If an account exists for that email address, a password reset link has been sent."
    }), 200


if __name__ == "__main__":
    init_db()
    app.run(debug=False)