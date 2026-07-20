import os
import re
import ssl
import smtplib
from email.message import EmailMessage
from html import escape

from flask import Flask, request, jsonify

app = Flask(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.example.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

MAIL_FROM = os.getenv("MAIL_FROM", SMTP_USERNAME or "no-reply@example.com")
MAIL_TO = os.getenv("MAIL_TO", "admin@example.com")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def send_contact_email(name: str, email: str, subject: str, message: str) -> None:
    safe_name = escape(name)
    safe_email = escape(email)
    safe_subject = escape(subject)
    safe_message = escape(message).replace("\n", "<br>")

    msg = EmailMessage()
    msg["Subject"] = f"Contact Form: {subject}"
    msg["From"] = MAIL_FROM
    msg["To"] = MAIL_TO
    msg["Reply-To"] = email

    plain_body = (
        f"New contact form submission\n\n"
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Subject: {subject}\n\n"
        f"Message:\n{message}\n"
    )

    html_body = f"""
    <html>
      <body>
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> {safe_name}</p>
        <p><strong>Email:</strong> {safe_email}</p>
        <p><strong>Subject:</strong> {safe_subject}</p>
        <p><strong>Message:</strong></p>
        <p>{safe_message}</p>
      </body>
    </html>
    """

    msg.set_content(plain_body)
    msg.add_alternative(html_body, subtype="html")

    if SMTP_USE_TLS:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls(context=context)
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ssl.create_default_context(), timeout=15) as server:
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)


@app.route("/contact", methods=["POST"])
def contact():
    data = request.get_json(silent=True) if request.is_json else request.form

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    subject = (data.get("subject") or "Website Contact Form").strip()
    message = (data.get("message") or "").strip()

    errors = {}

    if not name:
        errors["name"] = "Name is required."
    elif len(name) > 100:
        errors["name"] = "Name must be 100 characters or fewer."

    if not email:
        errors["email"] = "Email is required."
    elif not EMAIL_RE.match(email):
        errors["email"] = "A valid email address is required."
    elif len(email) > 254:
        errors["email"] = "Email must be 254 characters or fewer."

    if not subject:
        errors["subject"] = "Subject is required."
    elif len(subject) > 150:
        errors["subject"] = "Subject must be 150 characters or fewer."

    if not message:
        errors["message"] = "Message is required."
    elif len(message) > 5000:
        errors["message"] = "Message must be 5000 characters or fewer."

    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    try:
        send_contact_email(name=name, email=email, subject=subject, message=message)
    except Exception:
        app.logger.exception("Failed to send contact form email")
        return jsonify({"ok": False, "error": "Unable to send message at this time."}), 500

    return jsonify({"ok": True, "message": "Your message has been sent."}), 200


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")