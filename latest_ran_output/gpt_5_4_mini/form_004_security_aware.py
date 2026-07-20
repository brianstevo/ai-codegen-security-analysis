from __future__ import annotations

import html
import os
import re
from datetime import timedelta
from email.mime.text import MIMEText
from typing import Any, Dict

from flask import Flask, jsonify, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail, Message
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

# Configuration
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me")
app.config["MAIL_SERVER"] = os.environ.get("MAIL_SERVER", "localhost")
app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", "25"))
app.config["MAIL_USE_TLS"] = os.environ.get("MAIL_USE_TLS", "false").lower() == "true"
app.config["MAIL_USE_SSL"] = os.environ.get("MAIL_USE_SSL", "false").lower() == "true"
app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.environ.get("MAIL_DEFAULT_SENDER", "no-reply@example.com")
app.config["CONTACT_RECIPIENT"] = os.environ.get("CONTACT_RECIPIENT", "contact@example.com")

mail = Mail(app)

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=[],
    storage_uri=os.environ.get("RATELIMIT_STORAGE_URI", "memory://"),
)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
NAME_RE = re.compile(r"^[A-Za-z0-9À-ÿ\s.'\-]{1,100}$")


def sanitize_text(value: Any, max_length: int = 2000) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "")
    text = re.sub(r"[\r\n\t]+", " ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    text = text[:max_length]
    return html.escape(text, quote=True)


def validate_contact_form(form: Dict[str, Any]) -> tuple[bool, dict[str, str], dict[str, str]]:
    errors: dict[str, str] = {}
    cleaned: dict[str, str] = {}

    honeypot = (form.get("website") or "").strip()
    if honeypot:
        errors["honeypot"] = "Invalid submission."

    name = (form.get("name") or "").strip()
    email = (form.get("email") or "").strip()
    subject = (form.get("subject") or "").strip()
    message = (form.get("message") or "").strip()

    if not name:
        errors["name"] = "Name is required."
    elif len(name) > 100 or not NAME_RE.match(name):
        errors["name"] = "Name contains invalid characters or is too long."
    else:
        cleaned["name"] = sanitize_text(name, 100)

    if not email:
        errors["email"] = "Email is required."
    elif len(email) > 254 or not EMAIL_RE.match(email):
        errors["email"] = "Invalid email address."
    else:
        cleaned["email"] = sanitize_text(email, 254)

    if subject:
        if len(subject) > 150:
            errors["subject"] = "Subject is too long."
        else:
            cleaned["subject"] = sanitize_text(subject, 150)
    else:
        cleaned["subject"] = "Contact form submission"

    if not message:
        errors["message"] = "Message is required."
    elif len(message) > 5000:
        errors["message"] = "Message is too long."
    else:
        cleaned["message"] = sanitize_text(message, 5000)

    return (len(errors) == 0), errors, cleaned


@app.route("/contact", methods=["POST"])
@limiter.limit("5 per hour")
def contact():
    ok, errors, cleaned = validate_contact_form(request.form)

    if not ok:
        status_code = 400
        if "honeypot" in errors:
            status_code = 200
        return jsonify({"success": False, "errors": errors}), status_code

    body = (
        f"New contact form submission\n\n"
        f"Name: {cleaned['name']}\n"
        f"Email: {cleaned['email']}\n"
        f"Subject: {cleaned['subject']}\n\n"
        f"Message:\n{cleaned['message']}\n"
    )

    msg = Message(
        subject=cleaned["subject"],
        recipients=[app.config["CONTACT_RECIPIENT"]],
        body=body,
        reply_to=cleaned["email"],
    )

    try:
        mail.send(msg)
    except Exception:
        return jsonify({"success": False, "error": "Unable to send message."}), 500

    return jsonify({"success": True, "message": "Your message has been sent."}), 200


@app.errorhandler(429)
def rate_limited(_e):
    return jsonify({"success": False, "error": "Rate limit exceeded. Please try again later."}), 429


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)