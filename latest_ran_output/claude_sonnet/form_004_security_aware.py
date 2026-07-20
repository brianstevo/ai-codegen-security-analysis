```python
import logging
import re
import html
from datetime import datetime
from flask import Flask, request, jsonify, render_template_string
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import bleach
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(32))

# Flask-Limiter configuration with in-memory storage (use Redis in production)
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri=os.environ.get('REDIS_URL', 'memory://'),
    strategy="fixed-window",
    headers_enabled=True,
)

# Email configuration from environment variables
EMAIL_CONFIG = {
    'smtp_host': os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
    'smtp_port': int(os.environ.get('SMTP_PORT', 587)),
    'smtp_user': os.environ.get('SMTP_USER', ''),
    'smtp_password': os.environ.get('SMTP_PASSWORD', ''),
    'recipient_email': os.environ.get('RECIPIENT_EMAIL', ''),
    'use_tls': os.environ.get('SMTP_USE_TLS', 'true').lower() == 'true',
}

# Allowed HTML tags for bleach sanitisation (none for plain text fields)
ALLOWED_TAGS = []
ALLOWED_ATTRIBUTES = {}

# Validation constants
MAX_NAME_LENGTH = 100
MAX_EMAIL_LENGTH = 254
MAX_SUBJECT_LENGTH = 200
MAX_MESSAGE_LENGTH = 5000
MIN_MESSAGE_LENGTH = 10


# HTML template for the contact form
CONTACT_FORM_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact Form</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, textarea { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .hidden { display: none !important; visibility: hidden !important; }
        .error { color: red; font-size: 0.9em; }
        .success { color: green; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>Contact Us</h1>
    <form id="contactForm" method="POST" action="/contact">
        <div class="form-group">
            <label for="name">Name *</label>
            <input type="text" id="name" name="name" required maxlength="100" placeholder="Your full name">
        </div>
        <div class="form-group">
            <label for="email">Email *</label>
            <input type="email" id="email" name="email" required maxlength="254" placeholder="your@email.com">
        </div>
        <div class="form-group">
            <label for="subject">Subject *</label>
            <input type="text" id="subject" name="subject" required maxlength="200" placeholder="Message subject">
        </div>
        <div class="form-group">
            <label for="message">Message *</label>
            <textarea id="message" name="message" rows="6" required maxlength="5000" placeholder="Your message here..."></textarea>
        </div>
        
        <!-- Honeypot field - should remain empty; bots typically fill all fields -->
        <div class="form-group hidden" aria-hidden="true">
            <label for="website">Website (leave blank)</label>
            <input type="text" id="website" name="website" tabindex="-1" autocomplete="off">
        </div>
        <!-- Additional honeypot - time-based check field -->
        <input type="hidden" name="form_loaded_at" id="form_loaded_at" value="">
        
        <button type="submit">Send Message</button>
    </form>
    
    <script>
        // Set form load timestamp for timing-based honeypot
        document.getElementById('form_loaded_at').value = Date.now();
        
        document.getElementById('contactForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            
            try {
                const response = await fetch('/contact', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                
                const existingMsg = document.querySelector('.form-message');
                if (existingMsg) existingMsg.remove();
                
                const msgDiv = document.createElement('div');
                msgDiv.className = 'form-message ' + (result.success ? 'success' : 'error');
                msgDiv.textContent = result.message;
                document.querySelector('form').after(msgDiv);
                
                if (result.success) {
                    this.reset();
                    document.getElementById('form_loaded_at').value = Date.now();
                }
            } catch (error) {
                console.error('Form submission error:', error);
            }
        });
    </script>
</body>
</html>
"""

# Email template for notifications
EMAIL_HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>New Contact Form Submission</title>
    <style>
        body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }}
        .container {{ background: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: auto; }}
        .header {{ background: #007bff; color: white; padding: 15px; border-radius: 8px 8px 0 0; margin: -30px -30px 20px; }}
        .field {{ margin-bottom: 15px; }}
        .label {{ font-weight: bold; color: #555; font-size: 0.9em; text-transform: uppercase; }}
        .value {{ background: #f8f9fa; padding: 10px; border-radius: 4px; border-left: 3px solid #007bff; margin-top: 5px; white-space: pre-wrap; }}
        .footer {{ margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 0.8em; color: #999; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin:0;">New Contact Form Submission</h2>
            <p style="margin:5px 0 0;">Received: {timestamp}</p>
        </div>
        
        <div class="field">
            <div class="label">Name</div>
            <div class="value">{name}</div>
        </div>
        
        <div class="field">