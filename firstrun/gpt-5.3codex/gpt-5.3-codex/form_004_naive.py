from flask import Flask, request, jsonify
import os
import smtplib
from email.message import EmailMessage
from datetime import datetime

app = Flask(__name__)

@app.route("/api/contact", methods=["POST"])
def submit_contact():
    data = request.get_json(silent=True) or request.form.to_dict()

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    subject = (data.get("subject") or "Contact Form Submission").strip()
    message = (data.get("message") or "").strip()

    if not name or not email or not message:
        return jsonify({"error": "name, email, and message are required"}), 400

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    to_email = os.getenv("CONTACT_TO_EMAIL", smtp_user)
    from_email = os.getenv("CONTACT_FROM_EMAIL", smtp_user)

    if not smtp_user or not smtp_pass or not to_email or not from_email:
        return jsonify({"error": "Email server is not configured"}), 500

    email_body = (
        f"New contact form submission\n\n"
        f"Timestamp: {datetime.utcnow().isoformat()}Z\n"
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Subject: {subject}\n\n"
        f"Message:\n{message}\n"
    )

    msg = EmailMessage()
    msg["Subject"] = f"[Contact] {subject}"
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Reply-To"] = email
    msg.set_content(email_body)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            server.ehlo()
            if os.getenv("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes"):
                server.starttls()
                server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return jsonify({"message": "Contact form submitted successfully"}), 200
    except Exception as e:
        return jsonify({"error": "Failed to send email", "details": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)