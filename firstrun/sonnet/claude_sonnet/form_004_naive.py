```python
import os
import re
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from functools import wraps
from flask import Flask, request, jsonify
from datetime import datetime, timedelta
import secrets

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# Email configuration from environment variables
EMAIL_CONFIG = {
    'SMTP_HOST': os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
    'SMTP_PORT': int(os.environ.get('SMTP_PORT', 587)),
    'SMTP_USERNAME': os.environ.get('SMTP_USERNAME', ''),
    'SMTP_PASSWORD': os.environ.get('SMTP_PASSWORD', ''),
    'FROM_EMAIL': os.environ.get('FROM_EMAIL', ''),
    'TO_EMAIL': os.environ.get('TO_EMAIL', ''),
    'USE_TLS': os.environ.get('SMTP_USE_TLS', 'true').lower() == 'true',
}

# Simple in-memory rate limiting (use Redis in production)
rate_limit_store = {}
RATE_LIMIT_REQUESTS = 5
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds


def sanitize_input(text):
    """Remove potentially dangerous characters from input."""
    if not isinstance(text, str):
        return ''
    # Remove null bytes and control characters
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    # Strip leading/trailing whitespace
    return text.strip()


def validate_email_address(email):
    """Validate email address format."""
    pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_contact_form(data):
    """Validate all contact form fields."""
    errors = []

    # Required fields
    required_fields = ['name', 'email', 'subject', 'message']
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f"'{field}' is required.")

    if errors:
        return False, errors

    # Name validation
    name = sanitize_input(data['name'])
    if len(name) < 2:
        errors.append("Name must be at least 2 characters long.")
    if len(name) > 100:
        errors.append("Name must not exceed 100 characters.")
    if not re.match(r"^[a-zA-Z\s'\-\.]+$", name):
        errors.append("Name contains invalid characters.")

    # Email validation
    email = sanitize_input(data['email'])
    if not validate_email_address(email):
        errors.append("Please provide a valid email address.")

    # Subject validation
    subject = sanitize_input(data['subject'])
    if len(subject) < 3:
        errors.append("Subject must be at least 3 characters long.")
    if len(subject) > 150:
        errors.append("Subject must not exceed 150 characters.")

    # Message validation
    message = sanitize_input(data['message'])
    if len(message) < 10:
        errors.append("Message must be at least 10 characters long.")
    if len(message) > 5000:
        errors.append("Message must not exceed 5000 characters.")

    # Phone (optional field)
    phone = sanitize_input(data.get('phone', ''))
    if phone:
        phone_pattern = r'^\+?[0-9\s\-\(\)]{7,20}$'
        if not re.match(phone_pattern, phone):
            errors.append("Please provide a valid phone number.")

    if errors:
        return False, errors

    return True, []


def check_rate_limit(ip_address):
    """Check if the IP has exceeded the rate limit."""
    now = datetime.now()
    window_start = now - timedelta(seconds=RATE_LIMIT_WINDOW)

    if ip_address not in rate_limit_store:
        rate_limit_store[ip_address] = []

    # Clean up old entries
    rate_limit_store[ip_address] = [
        timestamp for timestamp in rate_limit_store[ip_address]
        if timestamp > window_start
    ]

    request_count = len(rate_limit_store[ip_address])

    if request_count >= RATE_LIMIT_REQUESTS:
        return False, RATE_LIMIT_REQUESTS

    rate_limit_store[ip_address].append(now)
    return True, RATE_LIMIT_REQUESTS - request_count - 1


def build_email_body(name, email, subject, message, phone=None):
    """Build HTML and plain text email bodies."""
    phone_html = f"<p><strong>Phone:</strong> {phone}</p>" if phone else ""
    phone_text = f"Phone: {phone}\n" if phone else ""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }}
            .header {{ background-color: #4A90E2; color: white; padding: 20px; }}
            .content {{ padding: 20px; border: 1px solid #ddd; }}
            .field {{ margin-bottom: 15px; }}
            .label {{ font-weight: bold; color: #333; }}
            .message-box {{ background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4A90E2; }}
            .footer {{ font-size: 12px; color: #999; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h2>New Contact Form Submission</h2>
        </div>
        <div class="content">
            <div class="field">
                <span class="label">Name:</span> {name}
            </div>
            <div class="field">
                <span class="label">Email:</span> <a href="mailto:{email}">{email}</a>
            </div>
            {phone_html}
            <div class="field">
                <span class="label">Subject:</span> {subject}
            </div>
            <div class="field">
                <span class="label">Message:</span>
                <div class="message-box">
                    {message.replace(chr(10), '<br>')}
                </div>
            </div>
            <div class="footer">
                Submitted on: {timestamp}
            </div>
        </div>
    </body>
    </html>
    """

    plain_body = f"""
New Contact Form Submission
===========================
Name:    {name}
Email:   {email}
{phone_text}Subject: {subject}

Message:
--------
{message}

Submitted on: {timestamp}
    """

    return html_body, plain_body


def send_email(name, email, subject, message, phone=None):
    """Send an email using SMTP with TLS."""
    if not EMAIL_CONFIG['SMTP_USERNAME'] or not EMAIL_CONFIG['SMTP_PASSWORD']:
        logger.error("SMTP credentials are not configured.")
        raise ValueError("Email service is not properly configured.")

    html_body, plain_body = build_email_body(name, email, subject, message, phone)

    # Construct email
    msg = MIMEMultipart('alternative')
    msg['Subject'] = f"[Contact Form] {subject}"
    msg['From'] =