# contact_app.py
import os
import re
from datetime import timedelta

from flask import Flask, request, jsonify, abort
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from markupsafe import escape
from email.message import EmailMessage
import smtplib

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET", "change-me")
app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER", "localhost")
app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", 25))
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME", "")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD", "")
app.config["MAIL_USE_TLS"] = os.getenv("MAIL_USE_TLS", "false").lower() == "true"
app.config["MAIL_USE_SSL"] = os.getenv("MAIL_USE_SSL", "false").lower() == "true"
app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_DEFAULT_SENDER", "no-reply@example.com")
app.config["CONTACT_RECIPIENT"] = os.getenv("CONTACT_RECIPIENT", "contact@example.com")

# Rate limiter: 5 submissions per IP per hour
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri="memory://",
)

EMAIL_REGEX = re.compile(r"^[^@]+@[^@]+\.[^@]+$")


def validate_fields(data):
    errors = {}

    # Name validation
    name = data.get("name", "").strip()
    if not name:
        errors["name"] = "Name is required."
    elif len(name) > 100:
        errors["name"] = "Name must be under 100 characters."

    # Email validation
    email = data.get("email", "").strip()
    if not email:
        errors["email"] = "Email is required."
    elif not EMAIL_REGEX.match(email):
        errors["email"] = "Invalid email format."

    # Subject validation
    subject = data.get("subject", "").strip()
    if not subject:
        errors["subject"] = "Subject is required."
    elif len(subject) > 150:
        errors["subject"] = "Subject must be under 150 characters."

    # Message validation
    message = data.get("message", "").strip()
    if not message:
        errors["message"] = "Message is required."
    elif len(message) > 2000:
        errors["message"] = "Message must be under 2000 characters."

    return errors


def sanitize_input(text: str) -> str:
    """Escape HTML to prevent injection in email body."""
    return escape(text)


def send_email(to_address: str, subject: str, html_body: str):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = app.config["MAIL_DEFAULT_SENDER"]
    msg["To"] = to_address
    msg.set_content(html_body, subtype="html")

    try:
        if app.config["MAIL_USE_SSL"]:
            smtp_cls = smtplib.SMTP_SSL
        else:
            smtp_cls = smtplib.SMTP

        with smtp_cls(app.config["MAIL_SERVER"], app.config["MAIL_PORT"]) as server:
            if app.config["MAIL_USE_TLS"] and not app.config["MAIL_USE_SSL"]:
                server.starttls()
            if app.config["MAIL_USERNAME"]:
                server.login(app.config["MAIL_USERNAME"], app.config["MAIL_PASSWORD"])
            server.send_message(msg)
    except Exception as e:
        # In production you would log this error
        print(f"Failed to send email: {e}")
        raise


@app.route("/contact", methods=["POST"])
@limiter.limit("5 per hour")
def contact():
    if not request.is_json:
        abort(400, description="Request must be JSON")

    data = request.get_json()

    # Honeypot field check (should be empty)
    honeypot = data.get("website", "")
    if honeypot.strip():
        return jsonify({"status": "error", "message": "Bot detected"}), 400

    errors = validate_fields(data)
    if errors:
        return jsonify({"status": "error", "errors": errors}), 422

    # Sanitize fields
    name = sanitize_input(data["name"])
    email = sanitize_input(data["email"])
    subject = sanitize_input(data["subject"])
    message = sanitize_input(data["message"])

    # Build email body using a simple template
    email_body = f"""
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> {name}</p>
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Subject:</strong> {subject}</p>
        <p><strong>Message:</strong></p>
        <div>{message.replace('\n', '<br>')}</div>
    """

    try:
        send_email(
            to_address=app.config["CONTACT_RECIPIENT"],
            subject=f"Contact Form: {subject}",
            html_body=email_body,
        )
    except Exception:
        return jsonify({"status": "error", "message": "Failed to send email"}), 500

    return jsonify({"status": "success", "message": "Your message has been sent."}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)