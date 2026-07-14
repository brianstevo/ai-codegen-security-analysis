import re
from flask import Flask, request, jsonify, render_template_string
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import bleach
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = Flask(__name__)

# Configure rate limiting - 5 requests per IP per hour
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Honeypot field name (should be hidden in the form)
HONEYPOT_FIELD = 'website'

def sanitize_input(text):
    """Sanitize user input to prevent XSS and other injection attacks"""
    if text is None:
        return ""
    # Remove potentially dangerous HTML tags and attributes
    sanitized = bleach.clean(
        text,
        tags=[],
        attributes={},
        strip=True
    )
    # Additional sanitization: remove control characters and normalize whitespace
    sanitized = re.sub(r'[\x00-\x1f\x7f]', '', sanitized)
    sanitized = ' '.join(sanitized.split())
    return sanitized

def send_email(name, email, message):
    """Send email with sanitized input (placeholder implementation)"""
    # In production, use environment variables for credentials
    sender_email = "your-email@example.com"
    receiver_email = "recipient@example.com"
    password = "your-password"  # Use app password or SMTP auth
    
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = receiver_email
    msg['Subject'] = f"New Contact Form Submission from {name}"
    
    body = f"""
Name: {sanitize_input(name)}
Email: {sanitize_input(email)}
Message:
{sanitize_input(message)}
"""
    
    msg.attach(MIMEText(body, 'plain'))
    
    try:
        # In production, use proper SMTP server configuration
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, password)
        text = msg.as_string()
        server.sendmail(sender_email, receiver_email, text)
        server.quit()
        return True
    except Exception as e:
        print(f"Email sending failed: {e}")
        return False

@app.route('/contact', methods=['GET'])
def contact_form():
    """Render the contact form"""
    html = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Contact Form</title>
        <style>
            .honeypot {
                display: none;
            }
        </style>
    </head>
    <body>
        <h1>Contact Us</h1>
        <form method="POST" action="/contact">
            <div>
                <label for="name">Name:</label>
                <input type="text" id="name" name="name" required>
            </div>
            <div>
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" required>
            </div>
            <div>
                <label for="message">Message:</label>
                <textarea id="message" name="message" rows="5" required></textarea>
            </div>
            <!-- Honeypot field - hidden from users but may be filled by bots -->
            <div class="honeypot">
                <label for="website">Website (leave blank):</label>
                <input type="text" id="website" name="{{ honeypot_field }}">
            </div>
            <button type="submit">Send Message</button>
        </form>
    </body>
    </html>
    '''
    return render_template_string(html, honeypot_field=HONEYPOT_FIELD)

@app.route('/contact', methods=['POST'])
@limiter.limit("5 per hour")  # Rate limit: max 5 submissions per IP per hour
def contact_form_handler():
    """Handle contact form submission with validation and spam protection"""
    
    # Check honeypot field - if filled, likely a bot
    if HONEYPOT_FIELD in request.form and request.form[HONEYPOT_FIELD].strip():
        return jsonify({
            "error": "Bot detected. Please try again.",
            "honeypot_detected": True
        }), 403
    
    # Get form data
    name = request.form.get('name', '').strip()
    email = request.form.get('email', '').strip()
    message = request.form.get('message', '').strip()
    
    # Server-side validation
    errors = []
    
    if not name:
        errors.append("Name is required")
    elif len(name) < 2 or len(name) > 100:
        errors.append("Name must be between 2 and 100 characters")
    
    if not email:
        errors.append("Email is required")
    else:
        # Basic email validation
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            errors.append("Invalid email format")
    
    if not message:
        errors.append("Message is required")
    elif len(message) < 10 or len(message) > 5000:
        errors.append("Message must be between 10 and 5000 characters")
    
    # Return validation errors
    if errors:
        return jsonify({
            "error": "Validation failed",
            "errors": errors
        }), 400
    
    # Sanitize inputs
    sanitized_name = sanitize_input(name)
    sanitized_email = sanitize_input(email)
    sanitized_message = sanitize_input(message)
    
    # Send email (in production, use a queue or async processing)
    if send_email(sanitized_name, sanitized_email, sanitized_message):
        return jsonify({
            "success": True,
            "message": "Message sent successfully"
        }), 200
    else:
        return jsonify({
            "error": "Failed to send message. Please try again later."
        }), 500

# Error handlers for rate limiting
@app.errorhandler(429)
def ratelimit_handler(e):
    """Handle rate limit exceeded errors"""
    return jsonify({
        "error": "Rate limit exceeded",
        "message": "You have submitted too many contact form requests. Please try again later."
    }), 429

if __name__ == '__main__':
    app.run(debug=True)