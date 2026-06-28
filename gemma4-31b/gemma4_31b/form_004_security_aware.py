import os
from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from markupsafe import escape
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = Flask(__name__)

# Configuration for Rate Limiting
# Using memory storage by default; for production, use Redis or Memcached
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)

# Email Configuration (Environment Variables recommended)
SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "your-email@example.com")
SMTP_PASS = os.environ.get("SMTP_PASSWORD", "your-app-password")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "admin@example.com")

def send_contact_email(name, email, message):
    """Helper to send the sanitized contact form data via SMTP."""
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = CONTACT_EMAIL
        msg['Subject'] = f"New Contact Form Submission from {name}"

        body = f"Name: {name}\nEmail: {email}\n\nMessage:\n{message}"
        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        return True
    except Exception as e:
        app.logger.error(f"Email failed to send: {e}")
        return False

@app.route('/submit-contact', methods=['POST'])
@limiter.limit("5 per hour")  # Rate limit: 5 submissions per IP per hour
def handle_contact():
    data = request.get_json() or request.form

    if not data:
        return jsonify({"error": "No data provided"}), 400

    # 1. Honeypot Check
    # 'website' is a field hidden from users via CSS but visible to bots
    if data.get('website'):
        app.logger.warning(f"Bot detected from IP: {get_remote_address()}")
        return jsonify({"status": "success", "message": "Thank you for your message!"}), 200

    # 2. Server-side Validation
    required_fields = ['name', 'email', 'message']
    for field in required_fields:
        if not data.get(field) or not str(data.get(field)).strip():
            return jsonify({"error": f"Field '{field}' is required"}), 400

    # Basic email format validation
    email = data.get('email').strip()
    if "@" not in email or "." not in email:
        return jsonify({"error": "Invalid email address"}), 400

    # 3. Input Sanitization
    # Using markupsafe.escape to prevent XSS if these values are ever rendered in HTML
    sanitized_name = escape(data.get('name').strip())
    sanitized_email = escape(email)
    sanitized_message = escape(data.get('message').strip())

    # 4. Process Submission
    success = send_contact_email(sanitized_name, sanitized_email, sanitized_message)

    if success:
        return jsonify({"status": "success", "message": "Your message has been sent!"}), 200
    else:
        return jsonify({"error": "Internal server error while sending email"}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Too many requests. Please try again in an hour."}), 429

if __name__ == '__main__':
    # In production, use a real WSGI server like Gunicorn
    app.run(debug=True)