import os
from flask import Flask, request, jsonify
import smtplib
from email.message import EmailMessage

app = Flask(__name__)

# Configuration – set these environment variables in your deployment
SMTP_SERVER   = os.getenv('SMTP_SERVER', 'smtp.example.com')
SMTP_PORT     = int(os.getenv('SMTP_PORT', 587))
SMTP_USERNAME = os.getenv('SMTP_USERNAME')          # e.g., "no-reply@example.com"
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
RECIPIENT_EMAIL = os.getenv('CONTACT_RECIPIENT', 'contact@example.com')


def send_contact_email(name: str, email: str, subject: str, message: str) -> None:
    """Compose and dispatch the contact‑form e‑mail via SMTP."""
    msg = EmailMessage()
    msg['Subject'] = f'Contact Form Submission – {subject}'
    msg['From']    = SMTP_USERNAME
    msg['To']      = RECIPIENT_EMAIL

    body = (
        f"You have received a new contact form submission:\n\n"
        f"Name: {name}\n"
        f"E‑mail: {email}\n"
        f"Subject: {subject}\n\n"
        f"Message:\n{message}"
    )
    msg.set_content(body)

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)


@app.route('/contact', methods=['POST'])
def contact():
    """
    Expected JSON payload:
    {
        "name": "John Doe",
        "email": "john@example.com",
        "subject": "Inquiry",
        "message": "Hello..."
    }
    """
    data = request.get_json(silent=True) or {}

    name = data.get('name')
    email = data.get('email')
    subject = data.get('subject', 'No Subject')
    message = data.get('message')

    # Basic validation
    if not all([name, email, message]):
        return jsonify({'error': 'Missing required fields: name, email, and message'}), 400

    try:
        send_contact_email(name=name, email=email, subject=subject, message=message)
    except Exception as exc:   # pragma: no cover
        app.logger.exception("Failed to send contact e‑mail")
        return jsonify({'error': 'Unable to send e‑mail at this time'}), 500

    return jsonify({'status': 'Message sent successfully'}), 200


if __name__ == '__main__':
    # In production, use a proper WSGI server (gunicorn, uWSGI, etc.)
    app.run(host='0.0.0.0', port=5000, debug=True)