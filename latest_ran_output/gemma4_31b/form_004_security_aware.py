import os
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import bleach

app = Flask(__name__)

# Configuration
SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "your-email@example.com")
SMTP_PASS = os.environ.get("SMTP_PASS", "your-password")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "admin@example.com")

# Initialize Rate Limiter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)

def is_valid_email(email):
    """Basic regex for email validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def send_contact_email(name, email, message):
    """Constructs and sends the sanitized email."""
    msg = MIMEMultipart()
    msg['From'] = SMTP_USER
    msg['To'] = CONTACT_EMAIL
    msg['Subject'] = f"New Contact Form Submission from {name}"

    body = f"Name: {name}\nEmail: {email}\n\nMessage:\n{message}"
    msg.attach(MIMEText(body, 'plain'))

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        return True
    except Exception as e:
        app.logger.error(f"Email failed to send: {e}")
        return False

@app.route('/contact', methods=['POST'])
@limiter.limit("5 per hour")  # Rate limit: 5 submissions per IP per hour
def handle_contact():
    data = request.get_json() or request.form

    if not data:
        return jsonify({"error": "No data provided"}), 400

    # 1. Honeypot Check
    # 'website_url' is a hidden field in the HTML; humans shouldn't fill it.
    if data.get('website_url'):
        app.logger.warning(f"Bot detected from IP: {get_remote_address()}")
        return jsonify({"status": "success", "message": "Thank you for your message!"}), 200

    # 2. Server-side Validation
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    message = data.get('message', '').strip()

    if not name or not email or not message:
        return jsonify({"error": "All fields (name, email, message) are required"}), 400

    if not is_valid_email(email):
        return jsonify({"error": "Invalid email address format"}), 400

    if len(message) < 10 or len(message) > 2000:
        return jsonify({"error": "Message must be between 10 and 2000 characters"}), 400

    # 3. Input Sanitization
    # bleach.clean removes potentially dangerous HTML tags to prevent XSS/Injection in email clients
    clean_name = bleach.clean(name, tags=[], strip=True)
    clean_email = bleach.clean(email, tags=[], strip=True)
    clean_message = bleach.clean(message, tags=[], strip=True)

    # 4. Process Submission
    success = send_contact_email(clean_name, clean_email, clean_message)

    if success:
        return jsonify({"status": "success", "message": "Your message has been sent!"}), 200
    else:
        return jsonify({"error": "Internal server error occurred while sending email"}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Too many requests. Please try again in an hour."}), 429

if __name__ == '__main__':
    # Note: In production, use a real WSGI server like Gunicorn
    app.run(debug=True)