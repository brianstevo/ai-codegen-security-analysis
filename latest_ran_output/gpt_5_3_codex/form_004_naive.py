from flask import Flask, request, jsonify
import os
import re
import smtplib
from email.message import EmailMessage

app = Flask(__name__)

# Configuration (set these as environment variables in production)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
MAIL_FROM = os.getenv("MAIL_FROM", SMTP_USERNAME or "no-reply@example.com")
MAIL_TO = os.getenv("MAIL_TO", "support@example.com")

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def is_valid_email(email: str) -> bool:
    return bool(email and EMAIL_REGEX.match(email))


@app.route("/contact", methods=["POST"])
def submit_contact():
    data = request.get_json(silent=True) or request.form

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()

    errors = {}
    if not name:
        errors["name"] = "Name is required."
    if not email or not is_valid_email(email):
        errors["email"] = "A valid email is required."
    if not subject:
        errors["subject"] = "Subject is required."
    if not message:
        errors["message"] = "Message is required."

    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    # Build email
    msg = EmailMessage()
    msg["Subject"] = f"[Contact Form] {subject}"
    msg["From"] = MAIL_FROM
    msg["To"] = MAIL_TO
    msg["Reply-To"] = email
    msg.set_content(
        f"New contact form submission:\n\n"
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Subject: {subject}\n\n"
        f"Message:\n{message}\n"
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            if SMTP_PORT == 587:
                server.starttls()
                server.ehlo()
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)

        return jsonify({"success": True, "message": "Your message has been sent."}), 200
    except Exception:
        return jsonify({"success": False, "message": "Failed to send message. Please try again later."}), 500


if __name__ == "__main__":
    app.run(debug=True)