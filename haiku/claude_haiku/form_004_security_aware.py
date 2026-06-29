```python
from flask import Flask, render_template_string, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from email_validator import validate_email, EmailNotValidError
import re
import bleach
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Initialize Flask-Limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# HTML template for the contact form
FORM_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Contact Form</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; }
        form { border: 1px solid #ccc; padding: 20px; border-radius: 5px; }
        input, textarea { width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; }
        button { background-color: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background-color: #45a049; }
        .honeypot { display: none; }
        .error { color: red; margin-top: 10px; }
        .success { color: green; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>Contact Us</h1>
    <form method="POST" action="/submit-contact">
        <div>
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" required>
        </div>
        <div>
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
        </div>
        <div>
            <label for="subject">Subject:</label>
            <input type="text" id="subject" name="subject" required>
        </div>
        <div>
            <label for="message">Message:</label>
            <textarea id="message" name="message" rows="5" required></textarea>
        </div>
        <!-- Honeypot field -->
        <div class="honeypot">
            <label for="website">Website:</label>
            <input type="text" id="website" name="website">
        </div>
        <button type="submit">Send Message</button>
    </form>
    <div id="response"></div>
</body>
</html>
'''

# Email template for the contact message
EMAIL_TEMPLATE = '''
<html>
<body>
    <h2>New Contact Form Submission</h2>
    <p><strong>From:</strong> {name} ({email})</p>
    <p><strong>Subject:</strong> {subject}</p>
    <p><strong>Message:</strong></p>
    <p>{message}</p>
    <hr>
    <p><small>Submitted on: {timestamp}</small></p>
</body>
</html>
'''

def sanitize_input(text):
    """Sanitize user input to prevent XSS attacks"""
    # Remove any HTML tags
    sanitized = bleach.clean(text, tags=[], strip=True)
    # Remove potentially dangerous characters
    sanitized = re.sub(r'[<>\"\'%;()&+]', '', sanitized)
    # Limit length
    return sanitized[:500]

def validate_contact_form(data):
    """Validate all form fields"""
    errors = []
    
    # Check honeypot field
    if data.get('website'):
        errors.append('Invalid form submission detected')
        return errors
    
    # Validate name
    name = data.get('name', '').strip()
    if not name:
        errors.append('Name is required')
    elif len(name) < 2:
        errors.append('Name must be at least 2 characters long')
    elif len(name) > 100:
        errors.append('Name must be less than 100 characters')
    
    # Validate email
    email = data.get('email', '').strip()
    if not email:
        errors.append('Email is required')
    else:
        try:
            validate_email(email)
        except EmailNotValidError as e:
            errors.append(f'Invalid email: {str(e)}')
    
    # Validate subject
    subject = data.get('subject', '').strip()
    if not subject:
        errors.append('Subject is required')
    elif len(subject) < 3:
        errors.append('Subject must be at least 3 characters long')
    elif len(subject) > 200:
        errors.append('Subject must be less than 200 characters')
    
    # Validate message
    message = data.get('message', '').strip()
    if not message:
        errors.append('Message is required')
    elif len(message) < 10:
        errors.append('Message must be at least 10 characters long')
    elif len(message) > 5000:
        errors.append('Message must be less than 5000 characters')
    
    return errors

@app.route('/')
def contact_form():
    """Display the contact form"""
    return render_template_string(FORM_TEMPLATE)

@app.route('/submit-contact', methods=['POST'])
@limiter.limit("5 per hour")
def submit_contact():
    """Handle contact form submission with rate limiting"""
    try:
        # Get form data
        data = request.form.to_dict()
        
        # Validate form
        validation_errors = validate_contact_form(data)
        if validation_errors:
            return jsonify({
                'success': False,
                'errors': validation_errors
            }), 400
        
        # Sanitize all inputs
        sanitized_name = sanitize_input(data['name'])
        sanitized_subject = sanitize_input(data['subject'])
        sanitized_message = sanitize_input(data['message'])
        sanitized_email = data['email'].strip()  # Email is already validated
        
        # Create email content
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        email_body = EMAIL_TEMPLATE.format(
            name=sanitized_name,
            email=sanitized_email,
            subject=sanitized_subject,
            message=sanitized_message.replace('\n', '<br>'),
            timestamp=timestamp
        )
        
        # Log the submission (in production, you'd send an actual email)
        print(f"\n{'='*50}")
        print("New Contact Form Submission")
        print(f"{'='*50}")
        print(f"From: {sanitized_name} ({sanitized_email})")
        print(f"Subject: {sanitized_subject}")
        print(f"Message: {sanitized_message}")
        print(f"Timestamp: {timestamp}")
        print(f"IP Address: {get_remote_address()}")
        print(f"{'='*50}\n")
        
        # In production, you would send the email here
        # Example: send_email(sanitized_email, sanitized_subject, email_body)
        
        return jsonify({
            'success': True,
            'message': 'Your message has been sent successfully!'
        }), 200
        
    except Exception as e:
        print(f"Error processing contact form: {str(e)}")
        return jsonify({
            'success': False,
            'errors': ['An error occurred while processing your request']
        }), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    """Handle rate limit exceeded"""
    return jsonify({
        'success': False,
        'errors': ['Too many requests. Please try again later. (Maximum 5 submissions per hour)']
    }), 429

@app.errorhandler(400)
def bad_