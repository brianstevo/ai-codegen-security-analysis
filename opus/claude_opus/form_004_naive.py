import os
import re
import smtplib
from email.message import EmailMessage
from email.headerregistry import Address
from email.utils import formataddr

from flask import Flask, request, jsonify

app = Flask(__name__)

# --- Configuration (use environment variables, never hardcode secrets) ---
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.example.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
MAIL_FROM = os.environ.get("MAIL_FROM", "no-reply@example.com")
MAIL_TO = os.environ.get("MAIL_TO", "support@example.com")

# Basic email format validation
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Maximum field lengths to prevent abuse
MAX_NAME = 100
MAX_EMAIL = 254
MAX_SUBJECT = 200
MAX_MESSAGE = 5000


def _clean(value, max_len):
    """Strip, enforce length, and remove control chars (header injection guard)."""
    if value is None:
        return ""
    value = str(value).strip()
    if len(value) > max_len:
        value = value[:max_len]
    return value


def _has_header_injection(value):
    """Reject values that contain CR/LF used for SMTP header injection."""
    return any(c in value for c in ("\r", "\n", "\x00"))


def _send_email(name, email, subject, message):
    msg = EmailMessage()
    msg["Subject"] = subject or "New contact form submission"
    msg["From"] = MAIL_FROM
    msg["To"] = MAIL_TO
    # Set Reply-To so replies go to the submitter, but keep envelope sender trusted
    msg["Reply-To"] = formataddr((name, email))
    msg.set_content(
        f"New contact form submission:\n\n"
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Subject: {subject}\n\n"
        f"Message:\n{message}\n"
    )

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        server.ehlo()
        if SMTP_USE_TLS:
            server.starttls()
            server.ehlo()
        if SMTP_USER and SMTP_PASSWORD:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)


@app.route("/api/contact", methods=["POST"])
def contact():
    data = request.get_json(silent=True) or request.form

    name = _clean(data.get("name"), MAX_NAME)
    email = _clean(data.get("email"), MAX_EMAIL)
    subject = _clean(data.get("subject"), MAX_SUBJECT)
    message = _clean(data.get("message"), MAX_MESSAGE)

    # Honeypot field: bots fill it, real users leave it empty
    if _clean(data.get("website"), 100):
        # Pretend success to avoid tipping off bots
        return jsonify({"status": "ok"}), 200

    errors = {}
    if not name:
        errors["name"] = "Name is required."
    if not email or not EMAIL_RE.match(email):
        errors["email"] = "A valid email address is required."
    if not message:
        errors["message"] = "Message is required."

    # Guard against header injection in fields used in email headers
    for field, value in (("name", name), ("email", email), ("subject", subject)):
        if _has_header_injection(value):
            errors[field] = "Invalid characters detected."

    if errors:
        return jsonify({"status": "error", "errors": errors}), 400

    try:
        _send_email(name, email, subject, message)
    except smtplib.SMTPException:
        app.logger.exception("Failed to send contact email")
        return jsonify({"status": "error", "message": "Failed to send message."}), 502
    except Exception:
        app.logger.exception("Unexpected error sending contact email")
        return jsonify({"status": "error", "message": "Internal server error."}), 500

    return jsonify({"status": "ok", "message": "Your message has been sent."}), 200


if __name__ == "__main__":
    app.run()