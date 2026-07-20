```python
import os
import hashlib
import html
from datetime import datetime
from flask import Flask, render_template_string, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail, Message
import bleach

app = Flask(__name__)

# Configuration
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'localhost')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', True)
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', 'noreply@example.com')

mail = Mail(app)

# Initialize Flask-Limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# HTML form template
FORM_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Contact Form</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="text"], input[type="email"], textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        textarea { resize: vertical; min-height: 150px; }
        button { background-color: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background-color: #45a049; }
        .error { color: red; margin-top: 10px; }
        .success { color: green; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>Contact Us</h1>
    <form id="contactForm" method="POST" action="/submit">
        <div class="form-group">
            <label for="name">Name *</label>
            <input type="text" id="name" name="name" required>
        </div>
        <div class="form-group">
            <label for="email">Email *</label>
            <input type="email" id="email" name="email" required>
        </div>
        <div class="form-group">
            <label for="subject">Subject *</label>
            <input type="text" id="subject" name="subject" required>
        </div>
        <div class="form-group">
            <label for="message">Message *</label>
            <textarea id="message" name="message" required></textarea>
        </div>
        <!-- Honeypot field - should remain empty -->
        <div style="display:none;">
            <input type="text" id="phone" name="phone" tabindex="-1" autocomplete="off">
        </div>
        <button type="submit">Send Message</button>
    </form>
    <div id="response"></div>
    <script>
        document.getElementById('contactForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            
            try {
                const response = await fetch('/submit', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                const responseDiv = document.getElementById('response');
                
                if (response.ok) {
                    responseDiv.innerHTML = '<p class="success">' + data.message + '</p>';
                    document.getElementById('contactForm').reset();
                } else {
                    responseDiv.innerHTML = '<p class="error">' + data.error + '</p>';
                }
            } catch (error) {
                document.getElementById('response').innerHTML = '<p class="error">An error occurred. Please try again.</p>';
            }
        });
    </script>
</body>
</html>
'''

# Email template
EMAIL_TEMPLATE = '''
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 10px; border-radius: 4px; }
        .content { margin-top: 20px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #333; }
        .value { color: #666; word-break: break-word; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>New Contact Form Submission</h2>
        </div>
        <div class="content">
            <div class="field">
                <div class="label">Name:</div>
                <div class="value">{{ name }}</div>
            </div>
            <div class="field">
                <div class="label">Email:</div>
                <div class="value">{{ email }}</div>
            </div>
            <div class="field">
                <div class="label">Subject:</div>
                <div class="value">{{ subject }}</div>
            </div>
            <div class="field">
                <div class="label">Message:</div>
                <div class="value">{{ message }}</div>
            </div>
            <div class="field" style="font-size: 12px; color: #999;">
                <div>Submitted at: {{ timestamp }}</div>
                <div>From IP: {{ ip_address }}</div>
            </div>
        </div>
    </div>
</body>
</html>
'''

def validate_email(email):
    """Basic email validation"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def sanitize_input(text, max_length=1000):
    """Sanitize user input to prevent XSS and other attacks"""
    if not isinstance(text, str):
        return ""
    
    # Limit length
    text = text[:max_length]
    
    # Remove any HTML tags
    text = bleach.clean(text, tags=[], strip=True)
    
    # Escape any remaining special characters
    text = html.escape(text)
    
    # Remove null bytes
    text = text.replace('\x00', '')
    
    return text.strip()

def validate_form_data(data):
    """Validate all form fields"""
    errors = []
    
    # Check required fields
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    subject = data.get('subject', '').strip()
    message = data.get('message', '').strip()
    
    if not name:
        errors.append('Name is required')
    elif len(name) < 2 or len(name) > 100:
        errors.append('Name must be between 2 and 100 characters')
    
    if not email:
        errors.append('Email is required')
    elif not validate_email(email):
        errors.append('Invalid email format')
    elif len(email) > 100:
        errors.append('Email is too long')
    
    if not subject:
        errors.append('Subject is required')
    elif len(subject) < 3 or len(subject) > 200:
        errors.append('Subject must be between 3