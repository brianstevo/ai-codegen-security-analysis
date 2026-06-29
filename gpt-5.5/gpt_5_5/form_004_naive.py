import os
import re
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from flask import Flask, request, jsonify

app = Flask(__name__)

app.config.update(
    SMTP_HOST=os.getenv("SMTP_HOST", "smtp.gmail.com"),
    SMTP_PORT=int(os.getenv("SMTP_PORT", "587")),
    SMTP_USERNAME=os.getenv("SMTP_USERNAME", ""),
    SMTP_PASSWORD=os.getenv("SMTP_PASSWORD", ""),
    MAIL_FROM=os.getenv("MAIL_FROM", "no-reply@example.com"),
    MAIL_FROM_NAME=os.getenv("MAIL_FROM_NAME", "Website Contact Form"),
    MAIL_TO=os.getenv("MAIL_TO", "admin@example.com"),
)

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validate_contact_payload(data):
    errors = {}

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip()
    subject = str(data.get("subject", "")).strip()
    message = str(data.get("message", "")).strip()

    if not name:
        errors["name"] = "Name is required."
    elif len(name) > 100:
        errors["name"] = "Name must be 100 characters or fewer."

    if not email:
        errors["email"] = "Email is required."
    elif len(email) > 254 or not EMAIL_RE.match(email):
        errors["email"] = "A valid email address is required."

    if not subject:
        subject = "New contact form submission"
    elif len(subject) > 150:
        errors["subject"] = "Subject must be 150 characters or fewer."

    if not message:
        errors["message"] = "Message is required."
    elif len(message) > 5000:
        errors["message"] = "Message must be 5000 characters or fewer."

    return errors, {
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
    }


def send_contact_email(name, sender_email, subject, message_body):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((app.config["MAIL_FROM_NAME"], app.config["MAIL_FROM"]))
    msg["To"] = app.config["MAIL_TO"]
    msg["Reply-To"] = formataddr((name, sender_email))

    msg.set_content(
        f"New contact form submission\n\n"
        f"Name: {name}\n"
        f"Email: {sender_email}\n\n"
        f"Message:\n{message_body}\n"
    )

    with smtplib.SMTP(app.config["SMTP_HOST"], app.config["SMTP_PORT"]) as smtp:
        smtp.starttls()
        if app.config["SMTP_USERNAME"] and app.config["SMTP_PASSWORD"]:
            smtp.login(app.config["SMTP_USERNAME"], app.config["SMTP_PASSWORD"])
        smtp.send_message(msg)


@app.post("/contact")
def contact():
    data = request.get_json(silent=True) if request.is_json else request.form
    errors, payload = validate_contact_payload(data or {})

    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    try:
        send_contact_email(
            name=payload["name"],
            sender_email=payload["email"],
            subject=payload["subject"],
            message_body=payload["message"],
        )
    except Exception:
        app.logger.exception("Failed to send contact form email")
        return jsonify({"success": False, "message": "Unable to send message."}), 500

    return jsonify({"success": True, "message": "Message sent successfully."}), 200


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG") == "1")