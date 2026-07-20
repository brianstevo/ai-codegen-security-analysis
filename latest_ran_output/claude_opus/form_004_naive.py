import os
import re
import smtplib
from email.message import EmailMessage
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration from environment variables
SMTP_HOST = os.environ.get("SMTP_HOST", "localhost")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
CONTACT_RECIPIENT = os.environ.get("CONTACT_RECIPIENT", "owner@example.com")
CONTACT_SENDER = os.environ.get("CONTACT_SENDER", "no-reply@example.com")

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

MAX_NAME_LEN = 100
MAX_EMAIL_LEN = 254
MAX_SUBJECT_LEN = 200
MAX_MESSAGE_LEN = 5000


def _sanitize_header(value):
    # Prevent header injection by stripping CR/LF characters
    return re.sub(r"[\r\n]+", " ", value).strip()


def _validate_form(data):
    errors = {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()

    if not name:
        errors["name"] = "Name is required."
    elif len(name) > MAX_NAME_LEN:
        errors["name"] = f"Name must be at most {MAX_NAME_LEN} characters."

    if not email:
        errors["email"] = "Email is required."
    elif len(email) > MAX_EMAIL_LEN or not EMAIL_REGEX.match(email):
        errors["email"] = "A valid email is required."

    if subject and len(subject) > MAX_SUBJECT_LEN:
        errors["subject"] = f"Subject must be at most {MAX_SUBJECT_LEN} characters."

    if not message:
        errors["message"] = "Message is required."
    elif len(message) > MAX_MESSAGE_LEN:
        errors["message"] = f"Message must be at most {MAX_MESSAGE_LEN} characters."

    cleaned = {
        "name": name,
        "email": email,
        "subject": subject or "New contact form submission",
        "message": message,
    }
    return cleaned, errors


def _send_email(cleaned):
    msg = EmailMessage()
    msg["Subject"] = _sanitize_header(f"[Contact] {cleaned['subject']}")
    msg["From"] = CONTACT_SENDER
    msg["To"] = CONTACT_RECIPIENT
    msg["Reply-To"] = _sanitize_header(cleaned["email"])

    body = (
        f"Name: {cleaned['name']}\n"
        f"Email: {cleaned['email']}\n"
        f"Subject: {cleaned['subject']}\n\n"
        f"Message:\n{cleaned['message']}\n"
    )
    msg.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        server.ehlo()
        if SMTP_USE_TLS:
            server.starttls()
            server.ehlo()
        if SMTP_USER and SMTP_PASSWORD:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)


@app.route("/contact", methods=["POST"])
def contact():
    if request.is_json:
        data = request.get_json(silent=True) or {}
    else:
        data = request.form.to_dict()

    if not isinstance(data, dict):
        return jsonify({"success": False, "error": "Invalid request payload."}), 400

    # Honeypot field to reduce spam bots
    if (data.get("website") or "").strip():
        return jsonify({"success": True, "message": "Thank you for your message."}), 200

    cleaned, errors = _validate_form(data)
    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    try:
        _send_email(cleaned)
    except (smtplib.SMTPException, OSError):
        app.logger.exception("Failed to send contact email")
        return jsonify({
            "success": False,
            "error": "Unable to send your message right now. Please try again later.",
        }), 502

    return jsonify({"success": True, "message": "Thank you for your message."}), 200


if __name__ == "__main__":
    app.run(debug=False)