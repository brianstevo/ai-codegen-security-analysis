from flask import Flask, request, render_template_string, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import bcrypt
import re
from email.mime.text import MIMEText
import smtplib
import secrets

app = Flask(__name__)

# Configure rate limiting (5 requests per hour per IP)
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["5 per hour"]
)

# Email configuration (replace with your actual email settings)
SMTP_SERVER = "smtp.example.com"
SMTP_PORT = 587
SMTP_USERNAME = "your_email@example.com"
SMTP_PASSWORD = "your_password"
EMAIL_FROM = "your_email@example.com"
EMAIL_TO = "recipient@example.com"

@app.route('/contact', methods=['GET'])
def contact_form():
    # Generate a random honeypot field name to make it harder for bots
    honeypot_field = f"hp_{secrets.token_hex(8)}"
    return render_template_string('''
        <form method="POST" action="/contact">
            <input type="text" name="name" placeholder="Name" required>
            <input type="email" name="email" placeholder="Email" required>
            <textarea name="message" placeholder="Message" required></textarea>
            <!-- Honeypot field (hidden from users but visible to bots) -->
            <div style="display:none;">
                <label for="{{ honeypot_field }}">Leave this empty</label>
                <input type="text" id="{{ honeypot_field }}" name="{{ honeypot_field }}">
            </div>
            <button type="submit">Submit</button>
        </form>
    ''', honeypot_field=honeypot_field)

@app.route('/contact', methods=['POST'])
@limiter.limit("5 per hour")
def handle_contact_form():
    # Check for honeypot field submission (bot detection)
    honeypot_fields = [key for key in request.form.keys() if key.startswith('hp_')]
    if any(request.form.get(field) for field in honeypot_fields):
        return jsonify({"success": False, "message": "Bot detected"}), 400

    # Validate and sanitize input
    name = request.form.get('name', '').strip()
    email = request.form.get('email', '').strip()
    message = request.form.get('message', '').strip()

    errors = []
    if not name:
        errors.append("Name is required")
    elif len(name) > 100:
        errors.append("Name too long")

    if not email:
        errors.append("Email is required")
    elif len(email) > 100 or not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        errors.append("Invalid email format")

    if not message:
        errors.append("Message is required")
    elif len(message) > 5000:
        errors.append("Message too long")

    if errors:
        return jsonify({"success": False, "message": "; ".join(errors)}), 400

    # Sanitize input to prevent XSS in email
    def sanitize(text):
        return re.sub(r'[<>&"\']', '', text)

    name = sanitize(name)
    email = sanitize(email)
    message = sanitize(message)

    # Create email content
    subject = f"New Contact Form Submission from {name}"
    body = f"""
    New contact form submission:

    Name: {name}
    Email: {email}

    Message:
    {message}
    """

    try:
        # Send email (using SMTP)
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = EMAIL_FROM
        msg['To'] = EMAIL_TO

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(EMAIL_FROM, [EMAIL_TO], msg.as_string())

        return jsonify({"success": True, "message": "Message sent successfully"}), 200
    except Exception as e:
        app.logger.error(f"Failed to send email: {str(e)}")
        return jsonify({"success": False, "message": "Failed to send message"}), 500

if __name__ == '__main__':
    app.run(debug=True)