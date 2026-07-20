import os
import re
import ssl
import time
import secrets
import hashlib
import smtplib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from urllib.parse import urlencode

from flask import Flask, request, jsonify

app = Flask(__name__)

app.config.update(
    RESET_TOKEN_TTL_SECONDS=int(os.getenv("RESET_TOKEN_TTL_SECONDS", "3600")),
    RESET_PASSWORD_URL=os.getenv("RESET_PASSWORD_URL", "http://localhost:3000/reset-password"),
    SMTP_HOST=os.getenv("SMTP_HOST", ""),
    SMTP_PORT=int(os.getenv("SMTP_PORT", "587")),
    SMTP_USERNAME=os.getenv("SMTP_USERNAME", ""),
    SMTP_PASSWORD=os.getenv("SMTP_PASSWORD", ""),
    SMTP_USE_TLS=os.getenv("SMTP_USE_TLS", "true").lower() == "true",
    SMTP_USE_SSL=os.getenv("SMTP_USE_SSL", "false").lower() == "true",
    MAIL_FROM=os.getenv("MAIL_FROM", "no-reply@example.com"),
    APP_NAME=os.getenv("APP_NAME", "My App"),
)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass
class User:
    id: str
    email: str


USERS_BY_EMAIL = {
    "user@example.com": User(id="usr_123", email="user@example.com"),
}

PASSWORD_RESET_TOKENS = {}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def cleanup_expired_reset_tokens() -> None:
    now = utcnow()
    expired = [
        digest
        for digest, record in PASSWORD_RESET_TOKENS.items()
        if record["expires_at"] <= now or record.get("used_at") is not None
    ]
    for digest in expired:
        PASSWORD_RESET_TOKENS.pop(digest, None)


def build_reset_url(raw_token: str) -> str:
    return f"{app.config['RESET_PASSWORD_URL']}?{urlencode({'token': raw_token})}"


def send_email(to_email: str, subject: str, text_body: str, html_body: str | None = None) -> None:
    msg = EmailMessage()
    msg["From"] = app.config["MAIL_FROM"]
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text_body)

    if html_body:
        msg.add_alternative(html_body, subtype="html")

    smtp_host = app.config["SMTP_HOST"]
    if not smtp_host:
        app.logger.warning("SMTP_HOST is not configured. Email content:\n%s", text_body)
        return

    smtp_port = app.config["SMTP_PORT"]

    if app.config["SMTP_USE_SSL"]:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context) as smtp:
            if app.config["SMTP_USERNAME"]:
                smtp.login(app.config["SMTP_USERNAME"], app.config["SMTP_PASSWORD"])
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(smtp_host, smtp_port) as smtp:
            smtp.ehlo()
            if app.config["SMTP_USE_TLS"]:
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
            if app.config["SMTP_USERNAME"]:
                smtp.login(app.config["SMTP_USERNAME"], app.config["SMTP_PASSWORD"])
            smtp.send_message(msg)


def send_password_reset_link(email: str) -> bool:
    cleanup_expired_reset_tokens()

    normalized_email = normalize_email(email)
    if not EMAIL_RE.match(normalized_email):
        return False

    user = USERS_BY_EMAIL.get(normalized_email)
    if not user:
        time.sleep(0.25)
        return False

    raw_token = secrets.token_urlsafe(48)
    digest = token_hash(raw_token)
    expires_at = utcnow() + timedelta(seconds=app.config["RESET_TOKEN_TTL_SECONDS"])

    for existing_digest, record in list(PASSWORD_RESET_TOKENS.items()):
        if record["user_id"] == user.id and record.get("used_at") is None:
            PASSWORD_RESET_TOKENS.pop(existing_digest, None)

    PASSWORD_RESET_TOKENS[digest] = {
        "user_id": user.id,
        "email": user.email,
        "created_at": utcnow(),
        "expires_at": expires_at,
        "used_at": None,
    }

    reset_url = build_reset_url(raw_token)
    ttl_minutes = max(1, app.config["RESET_TOKEN_TTL_SECONDS"] // 60)

    subject = f"Reset your {app.config['APP_NAME']} password"
    text_body = (
        f"We received a request to reset your {app.config['APP_NAME']} password.\n\n"
        f"Reset your password using this link:\n{reset_url}\n\n"
        f"This link expires in {ttl_minutes} minutes.\n\n"
        "If you did not request a password reset, you can ignore this email."
    )
    html_body = f"""
    <p>We received a request to reset your {app.config['APP_NAME']} password.</p>
    <p><a href="{reset_url}">Reset your password</a></p>
    <p>This link expires in {ttl_minutes} minutes.</p>
    <p>If you did not request a password reset, you can ignore this email.</p>
    """

    send_email(user.email, subject, text_body, html_body)
    return True


@app.post("/password-reset/request")
def request_password_reset():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")

    try:
        send_password_reset_link(email)
    except Exception:
        app.logger.exception("Failed to process password reset request")

    return jsonify(
        {
            "message": (
                "If an account exists for that email address, "
                "a password reset link has been sent."
            )
        }
    ), 202


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")