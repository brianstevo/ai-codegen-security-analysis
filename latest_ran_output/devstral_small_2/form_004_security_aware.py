from flask import Flask, request, render_template_string, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import bcrypt
import re
from email.mime.text import MIMEText
import smtplib
import secrets

app = Flask(__name__)

# Rate limiting setup (5 submissions per IP per hour)
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["5 per hour"]
)

# Email configuration
SMTP_SERVER = "smtp.example.com"
SMTP_PORT = 587
SMTP_USERNAME = "your_email@example.com"
SMTP_PASSWORD = "your_password"
EMAIL_FROM = "contact@example.com"
EMAIL_TO = "admin@example.com"

def sanitize_input(input_str):
    """Sanitize input to prevent XSS and basic injection"""
    if not isinstance(input_str, str):
        return ""
    # Basic HTML tag removal
    sanitized = re.sub(r'<[^>]*>', '', input_str)
    # Remove control characters except newline, carriage return, tab
    sanitized = ''.join(char for char in sanitized if char.isprintable() or char in '\n\r\t')
    return sanitized.strip()

def validate_email(email):
    """Basic email validation"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def send_email(subject, body):
    """Send email via SMTP"""
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = EMAIL_FROM
    msg['To'] = EMAIL_TO

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMPT_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Email sending failed: {e}")
        return False

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
    # Check honeypot field
    honeypot_fields = [key for key in request.form.keys() if key.startswith('hp_')]
    if any(request.form.get(field) for field in honeypot_fields):
        return jsonify({"success": False, "message": "Bot detected"}), 400

    # Get and sanitize form data
    name = sanitize_input(request.form.get('name', ''))
    email = sanitize_input(request.form.get('email', '')).lower()
    message = sanitize_input(request.form.get('message', ''))

    # Validate required fields
    if not all([name, email, message]):
        return jsonify({"success": False, "message": "All fields are required"}), 400

    # Validate email format
    if not validate_email(email):
        return jsonify({"success": False, "message": "Invalid email format"}), 400

    # Additional validation (name and message length)
    if len(name) > 100 or len(message) > 5000:
        return jsonify({"success": False, "message": "Name or message too long"}), 400

    # Create email content
    subject = f"New Contact Form Submission from {name}"
    body = f"""
    New contact form submission:

    Name: {name}
    Email: {email}
    Message:
    {message}

    ---
    This is an automated message. Please do not reply directly to this email.
    """

    # Send email
    if send_email(subject, body):
        return jsonify({"success": True, "message": "Message sent successfully"}), 200
    else:
        return jsonify({"success": False, "message": "Failed to send message"}), 500

if __name__ == '__main__':
    app.run(debug=True)