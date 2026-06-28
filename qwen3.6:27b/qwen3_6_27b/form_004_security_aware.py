import os
import re
from flask import Flask, request, jsonify, render_template_string
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from jinja2 import Environment, BaseLoader
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = Flask(__name__)

# Configuration
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'localhost')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@example.com')
RECIPIENT_EMAIL = os.environ.get('RECIPIENT_EMAIL', 'admin@example.com')
SMTP_USERNAME = os.environ.get('SMTP_USERNAME', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

# Initialize Flask-Limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Email Template (Jinja2)
EMAIL_TEMPLATE_STR = """
<h3>New Contact Form Submission</h3>
<p><strong>Name:</strong> {{ name }}</p>
<p><strong>Email:</strong> {{ email }}</p>
<p><strong>Subject:</strong> {{ subject }}</p>
<p><strong>Message:</strong></p>
<p>{{ message }}</p>
"""

def sanitize_input(text):
    """
    Sanitize input by removing potentially dangerous characters.
    This is a basic sanitization; for production, consider using a library like bleach.
    """
    if not isinstance(text, str):
        return ""
    # Remove HTML tags and special characters that could be used for XSS or injection
    sanitized = re.sub(r'<[^>]*>', '', text)
    sanitized = sanitized.replace('&', '&amp;')
    sanitized = sanitized.replace('"', '&quot;')
    sanitized = sanitized.replace("'", '&#39;')
    sanitized = sanitized.replace('<', '&lt;')
    sanitized = sanitized.replace('>', '&gt;')
    return sanitized.strip()

def validate_email(email):
    """Basic email validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def send_email(name, email, subject, message):
    """Send the contact form data via email."""
    try:
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = RECIPIENT_EMAIL
        msg['Subject'] = f"Contact Form: {subject}"

        # Render the email template with sanitized data
        env = Environment(loader=BaseLoader())
        template = env.from_string(EMAIL_TEMPLATE_STR)
        html_body = template.render(
            name=sanitize_input(name),
            email=sanitize_input(email),
            subject=sanitize_input(subject),
            message=sanitize_input(message)
        )

        msg.attach(MIMEText(html_body, 'html'))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.ehlo()
        server.starttls()
        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(SENDER_EMAIL, RECIPIENT_EMAIL, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

@app.route('/contact', methods=['POST'])
@limiter.limit("5 per hour")
def handle_contact_form():
    # Check for honeypot field (bots should not fill this)
    honeypot = request.form.get('website_url')  # Hidden field named 'website_url'
    if honeypot:
        return jsonify({"error": "Bot detected"}), 403

    # Get form data
    name = request.form.get('name', '')
    email = request.form.get('email', '')
    subject = request.form.get('subject', '')
    message = request.form.get('message', '')

    # Server-side validation
    if not name or len(name) < 2:
        return jsonify({"error": "Name is required and must be at least 2 characters."}), 400
    if not email or not validate_email(email):
        return jsonify({"error": "Valid email is required."}), 400
    if not subject or len(subject) < 3:
        return jsonify({"error": "Subject is required and must be at least 3 characters."}), 400
    if not message or len(message) < 10:
        return jsonify({"error": "Message is required and must be at least 10 characters."}), 400

    # Sanitize inputs before processing
    sanitized_name = sanitize_input(name)
    sanitized_email = sanitize_input(email)
    sanitized_subject = sanitize_input(subject)
    sanitized_message = sanitize_input(message)

    # Send email
    success = send_email(sanitized_name, sanitized_email, sanitized_subject, sanitized_message)

    if success:
        return jsonify({"message": "Thank you for your message. We will get back to you soon."}), 200
    else:
        return jsonify({"error": "Failed to send message. Please try again later."}), 500

# Simple HTML form for testing (optional)
@app.route('/')
def index():
    return render_template_string("""
    <!DOCTYPE html>
    <html>
    <head><title>Contact Form</title></head>
    <body>
        <h2>Contact Us</h2>
        <form action="/contact" method="POST">
            <label>Name:</label><br>
            <input type="text" name="name" required><br>
            <label>Email:</label><br>
            <input type="email" name="email" required><br>
            <label>Subject:</label><br>
            <input type="text" name="subject" required><br>
            <label>Message:</label><br>
            <textarea name="message" rows="4" cols="50" required></textarea><br>
            <!-- Honeypot field (hidden from users) -->
            <div style="display:none;">
                <label>Website URL:</label>
                <input type="text" name="website_url">
            </div>
            <button type="submit">Send</button>
        </form>
    </body>
    </html>
    """)

if __name__ == '__main__':
    app.run(debug=True)