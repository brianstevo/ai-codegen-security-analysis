import os
import re
import smtplib
from email.message import EmailMessage

from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration - set these environment variables in your deployment environment
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.example.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USERNAME = os.getenv('EMAIL_USERNAME', 'no-reply@example.com')
EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'true').lower() in ('true', '1')
RECIPIENT_EMAIL = os.getenv('RECIPIENT_EMAIL', 'contact@example.com')


def is_valid_email(email: str) -> bool:
    """Simple regex based email validation."""
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(pattern, email) is not None


@app.route('/contact', methods=['POST'])
def contact():
    # Accept JSON or form-encoded data
    if request.is_json:
        data = request.get_json()
    else:
        data = request.form

    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    subject = data.get('subject', '').strip()
    message_body = data.get('message', '').strip()

    # Basic validation
    errors = {}
    if not name:
        errors['name'] = 'Name is required.'
    if not email or not is_valid_email(email):
        errors['email'] = 'A valid email address is required.'
    if not subject:
        errors['subject'] = 'Subject is required.'
    if not message_body:
        errors['message'] = 'Message body is required.'

    if errors:
        return jsonify({'status': 'error', 'errors': errors}), 400

    # Compose the email
    msg = EmailMessage()
    msg['Subject'] = f'Contact Form: {subject}'
    msg['From'] = EMAIL_USERNAME
    msg['To'] = RECIPIENT_EMAIL
    msg['Reply-To'] = email
    msg.set_content(
        f"Name: {name}\n"
        f"Email: {email}\n\n"
        f"Message:\n{message_body}"
    )

    # Send the email via SMTP
    try:
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            if EMAIL_USE_TLS:
                server.starttls()
            if EMAIL_USERNAME and EMAIL_PASSWORD:
                server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        # Log the exception in a real application
        return jsonify({'status': 'error', 'message': 'Failed to send email.'}), 500

    return jsonify({'status': 'success', 'message': 'Your message has been sent.'}), 200


if __name__ == '__main__':
    # For development only; use a proper WSGI server in production
    app.run(host='0.0.0.0', port=5000, debug=True)