import os
import re
from flask import Flask, request, jsonify, render_template_string
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from markupsafe import escape
from datetime import datetime

app = Flask(__name__)

# Configure Flask-Limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Email configuration (placeholder for actual SMTP setup)
SMTP_SERVER = os.getenv('SMTP_SERVER', 'localhost')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SMTP_USER = os.getenv('SMTP_USER', '')
SMTP_PASS = os.getenv('SMTP_PASS', '')
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@example.com')

# Honeypot field name (hidden from real users, visible to bots)
HONEYPOT_FIELD = 'website_url'

def is_valid_email(email):
    """Basic email validation regex."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def sanitize_input(text):
    """Sanitize input by escaping HTML entities and stripping whitespace."""
    if not isinstance(text, str):
        return ""
    # Escape HTML to prevent XSS in logs/emails
    safe_text = escape(text).strip()
    # Remove any remaining control characters except newline/tab for readability
    safe_text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', safe_text)
    return safe_text

def send_email(subject, body):
    """Placeholder function to simulate sending an email."""
    # In a real application, use smtplib or a library like flask-mail
    print(f"[EMAIL SENT] To: {ADMIN_EMAIL}, Subject: {subject}")
    print(f"[EMAIL BODY]\n{body}")
    return True

@app.route('/contact', methods=['POST'])
@limiter.limit("5 per hour")
def handle_contact_form():
    try:
        data = request.get_json() if request.is_json else request.form.to_dict()
        
        # 1. Honeypot Check
        # If the honeypot field is filled, it's likely a bot
        if data.get(HONEYPOT_FIELD):
            return jsonify({"error": "Bot detected"}), 403

        # 2. Extract and Validate Fields
        name = data.get('name', '')
        email = data.get('email', '')
        message = data.get('message', '')

        if not name or not email or not message:
            return jsonify({"error": "All fields are required"}), 400

        # Validate Email Format
        if not is_valid_email(email):
            return jsonify({"error": "Invalid email format"}), 400

        # Check for excessively long inputs (prevent buffer overflow/DoS)
        if len(name) > 100 or len(message) > 5000:
            return jsonify({"error": "Input too long"}), 400

        # 3. Sanitize Input
        safe_name = sanitize_input(name)
        safe_email = sanitize_input(email)
        safe_message = sanitize_input(message)

        # 4. Construct Email Content
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        subject = f"New Contact Form Submission from {safe_name}"
        body = f"""
Name: {safe_name}
Email: {safe_email}
Time: {timestamp}

Message:
{safe_message}
        """

        # 5. Send Email
        try:
            send_email(subject, body)
        except Exception as e:
            print(f"Failed to send email: {e}")
            return jsonify({"error": "Internal server error"}), 500

        return jsonify({"message": "Message sent successfully"}), 200

    except Exception as e:
        print(f"Unexpected error: {e}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    # Disable limiter in debug mode for easier testing if needed, 
    # but keep it enabled here as per requirements.
    app.run(debug=True)