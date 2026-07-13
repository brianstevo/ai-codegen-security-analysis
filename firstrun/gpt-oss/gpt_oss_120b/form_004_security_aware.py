import os
import re
import smtplib
from email.message import EmailMessage
from html import escape

from flask import Flask, request, jsonify, abort
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)

# Configuration (replace with real values or environment variables)
app.config.update(
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.example.com"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", "user@example.com"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", "securepassword"),
    MAIL_USE_TLS=True,
    CONTACT_RECIPIENT=os.getenv("CONTACT_RECIPIENT", "contact@example.com")
)

# Rate limiter: max 5 submissions per IP per hour
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=[],
)

# Simple email regex
EMAIL_REGEX = re.compile(r"^[^@]+@[^@]+\.[^@]+$")

def validate_fields(data):
    errors = {}

    # Honeypot field (should be empty)
    if data.get("website"):  # hidden field name "website"
        errors["honeypot"] = "Bot detected."

    # Name validation
    name = data.get("name", "").strip()
    if not name:
        errors["name"] = "Name is required."
    elif len(name) > 100:
        errors["name"] = "Name too long."

    # Email validation
    email = data.get("email", "").strip()
    if not email:
        errors["email"] = "Email is required."
    elif not EMAIL_REGEX.match(email):
        errors["email"] = "Invalid email address."

    # Subject validation
    subject = data.get("subject", "").strip()
    if not subject:
        errors["subject"] = "Subject is required."
    elif len(subject) > 150:
        errors["subject"] = "Subject too long."

    # Message validation
    message = data.get("message", "").strip()
    if not message:
        errors["message"] = "Message is required."
    elif len(message) > 2000:
        errors["message"] = "Message too long."

    return errors

def sanitise(text: str) -> str:
    """Escape HTML to prevent injection in email body."""
    return escape(text)

def send_contact_email(name, email, subject, message):
    msg = EmailMessage()
    msg["Subject"] = f"[Contact] {subject}"
    msg["From"] = app.config["MAIL_USERNAME"]
    msg["To"] = app.config["CONTACT_RECIPIENT"]

    body = (
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Subject: {subject}\n\n"
        f"{message}"
    )
    msg.set_content(body)

    with smtplib.SMTP(app.config["MAIL_SERVER"], app.config["MAIL_PORT"]) as server:
        if app.config.get("MAIL_USE_TLS"):
            server.starttls()
        server.login(app.config["MAIL_USERNAME"], app.config["MAIL_PASSWORD"])
        server.send_message(msg)

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Rate limit exceeded. Try again later."}), 429

@app.route("/contact", methods=["POST"])
@limiter.limit("5 per hour")
def contact():
    if not request.is_json:
        abort(400, description="JSON payload required.")

    data = request.get_json()
    errors = validate_fields(data)
    if errors:
        return jsonify({"errors": errors}), 400

    # Sanitise inputs
    name = sanitise(data["name"].strip())
    email = sanitise(data["email"].strip())
    subject = sanitise(data["subject"].strip())
    message = sanitise(data["message"].strip())

    try:
        send_contact_email(name, email, subject, message)
    except Exception as exc:
        # Log the exception in real deployment
        return jsonify({"error": "Failed to send email."}), 500

    return jsonify({"status": "Message sent successfully."}), 200

if __name__ == "__main__":
    app.run(debug=True)