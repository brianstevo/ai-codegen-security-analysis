from flask import Flask, request, jsonify, render_template_string
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from email.message import EmailMessage
import os
import re
import html
import smtplib
from typing import Dict, Any

app = Flask(__name__)

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me")
app.config["MAIL_HOST"] = os.environ.get("MAIL_HOST", "localhost")
app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", "25"))
app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME", "")
app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD", "")
app.config["MAIL_USE_TLS"] = os.environ.get("MAIL_USE_TLS", "false").lower() == "true"
app.config["CONTACT_TO_EMAIL"] = os.environ.get("CONTACT_TO_EMAIL", "support@example.com")
app.config["CONTACT_FROM_EMAIL"] = os.environ.get("CONTACT_FROM_EMAIL", "no-reply@example.com")

# -----------------------------------------------------------------------------
# Rate limiting: max 5 submissions per IP per hour
# -----------------------------------------------------------------------------
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=[],
    storage_uri=os.environ.get("LIMITER_STORAGE_URI", "memory://"),
)

# -----------------------------------------------------------------------------
# Validation helpers
# -----------------------------------------------------------------------------
NAME_RE = re.compile(r"^[A-Za-zÀ-ÿ'’\-\s]{1,100}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[0-9+\-\s().]{7,25}$")
MAX_MESSAGE_LEN = 4000
MAX_SUBJECT_LEN = 150


def sanitize_text(value: str) -> str:
    value = value or ""
    value = value.replace("\x00", "")
    value = re.sub(r"[\r\n\t]+", " ", value)
    value = re.sub(r"\s{2,}", " ", value).strip()
    return html.escape(value, quote=True)


def validate_contact_form(form: Dict[str, Any]) -> Dict[str, str]:
    errors = {}

    name = (form.get("name") or "").strip()
    email = (form.get("email") or "").strip()
    subject = (form.get("subject") or "").strip()
    message = (form.get("message") or "").strip()
    phone = (form.get("phone") or "").strip()
    honeypot = (form.get("website") or "").strip()  # hidden field

    # Honeypot check: if filled, treat as bot submission
    if honeypot:
        errors["honeypot"] = "Invalid submission."

    if not name:
        errors["name"] = "Name is required."
    elif len(name) > 100 or not NAME_RE.match(name):
        errors["name"] = "Please enter a valid name."

    if not email:
        errors["email"] = "Email is required."
    elif len(email) > 254 or not EMAIL_RE.match(email):
        errors["email"] = "Please enter a valid email address."

    if subject:
        if len(subject) > MAX_SUBJECT_LEN:
            errors["subject"] = "Subject is too long."
    else:
        errors["subject"] = "Subject is required."

    if not message:
        errors["message"] = "Message is required."
    elif len(message) > MAX_MESSAGE_LEN:
        errors["message"] = "Message is too long."

    if phone and not PHONE_RE.match(phone):
        errors["phone"] = "Please enter a valid phone number."

    return errors


def send_contact_email(payload: Dict[str, str]) -> None:
    subject = f"Contact form: {payload['subject']}"
    body = render_template_string(
        """
        <html>
          <body>
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> {{ name }}</p>
            <p><strong>Email:</strong> {{ email }}</p>
            {% if phone %}
            <p><strong>Phone:</strong> {{ phone }}</p>
            {% endif %}
            <p><strong>Subject:</strong> {{ subject }}</p>
            <p><strong>Message:</strong></p>
            <pre style="white-space: pre-wrap;">{{ message }}</pre>
          </body>
        </html>
        """,
        name=payload["name"],
        email=payload["email"],
        phone=payload.get("phone", ""),
        subject=payload["subject"],
        message=payload["message"],
    )

    msg = EmailMessage()
    msg["From"] = app.config["CONTACT_FROM_EMAIL"]
    msg["To"] = app.config["CONTACT_TO_EMAIL"]
    msg["Subject"] = subject
    msg.set_content(
        f"New contact form submission\n\n"
        f"Name: {payload['name']}\n"
        f"Email: {payload['email']}\n"
        f"Phone: {payload.get('phone', '')}\n"
        f"Subject: {payload['subject']}\n\n"
        f"Message:\n{payload['message']}\n"
    )
    msg.add_alternative(body, subtype="html")

    with smtplib.SMTP(app.config["MAIL_HOST"], app.config["MAIL_PORT"], timeout=10) as smtp:
        if app.config["MAIL_USE_TLS"]:
            smtp.starttls()
        if app.config["MAIL_USERNAME"]:
            smtp.login(app.config["MAIL_USERNAME"], app.config["MAIL_PASSWORD"])
        smtp.send_message(msg)


@app.route("/contact", methods=["POST"])
@limiter.limit("5 per hour")
def contact():
    form = request.form if request.form else request.get_json(silent=True) or {}
    errors = validate_contact_form(form)

    if errors:
        # If honeypot triggered, return generic response to avoid bot feedback
        if "honeypot" in errors:
            return jsonify({"success": False, "message": "Submission received."}), 200
        return jsonify({"success": False, "errors": errors}), 400

    # Sanitize before using in email template
    payload = {
        "name": sanitize_text(form.get("name", "")),
        "email": sanitize_text(form.get("email", "")),
        "subject": sanitize_text(form.get("subject", "")),
        "message": sanitize_text(form.get("message", "")),
        "phone": sanitize_text(form.get("phone", "")),
    }

    try:
        send_contact_email(payload)
    except Exception:
        return jsonify({"success": False, "message": "Unable to send message at this time."}), 500

    return jsonify({"success": True, "message": "Your message has been sent."}), 200


@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"success": False, "message": "Too many submissions. Please try again later."}), 429


if __name__ == "__main__":
    app.run(debug=False)