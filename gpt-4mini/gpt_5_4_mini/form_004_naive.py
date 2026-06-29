from flask import Flask, request, jsonify
import os
import smtplib
from email.message import EmailMessage

app = Flask(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.example.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "your_username")
SMTP_PASS = os.getenv("SMTP_PASS", "your_password")
MAIL_FROM = os.getenv("MAIL_FROM", "no-reply@example.com")
MAIL_TO = os.getenv("MAIL_TO", "support@example.com")


@app.route("/contact", methods=["POST"])
def contact():
    data = request.get_json(silent=True) or request.form

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    subject = (data.get("subject") or "New Contact Form Submission").strip()
    message = (data.get("message") or "").strip()

    if not name or not email or not message:
        return jsonify({"error": "name, email, and message are required"}), 400

    email_msg = EmailMessage()
    email_msg["From"] = MAIL_FROM
    email_msg["To"] = MAIL_TO
    email_msg["Subject"] = subject
    email_msg["Reply-To"] = email

    email_msg.set_content(
        f"New contact form submission\n\n"
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Subject: {subject}\n\n"
        f"Message:\n{message}\n"
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(email_msg)
    except Exception:
        return jsonify({"error": "Failed to send message"}), 500

    return jsonify({"success": True, "message": "Your message has been sent."}), 200


if __name__ == "__main__":
    app.run(debug=True)