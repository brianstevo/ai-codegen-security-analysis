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
import hashlib

app = Flask(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY', secrets.token_hex(32)),
    SMTP_SERVER=os.environ.get('SMTP_SERVER', 'smtp.gmail.com'),
    SMTP_PORT=int(os.environ.get('SMTP_PORT', 587)),
    SMTP_USERNAME=os.environ.get('SMTP_USERNAME', ''),
    SMTP_PASSWORD=os.environ.get('SMTP_PASSWORD', ''),
    EMAIL_FROM=os.environ.get('EMAIL_FROM', ''),
    EMAIL_TO=os.environ.get('EMAIL_TO', ''),
    EMAIL_SUBJECT_PREFIX=os.environ.get('EMAIL_SUBJECT_PREFIX', '[Contact Form]'),
    MAX_MESSAGE_LENGTH=int(os.environ.get('MAX_MESSAGE_LENGTH', 5000)),
    MAX_NAME_LENGTH=int(os.environ.get('MAX_NAME_LENGTH', 100)),
    MAX_SUBJECT_LENGTH=int(os.environ.get('MAX_SUBJECT_LENGTH', 200)),
    RATE_LIMIT_REQUESTS=int(os.environ.get('RATE_LIMIT_REQUESTS', 5)),
    RATE_LIMIT_WINDOW=int(os.environ.get('RATE_LIMIT_WINDOW', 3600)),  # seconds
)

# In-memory rate limiting store (use Redis in production)
rate_limit_store = {}


# ─── Validation Helpers ──────────────────────────────────────────────────────

def sanitize_string(value: str) -> str:
    """Remove potentially dangerous characters from a string."""
    if not isinstance(value, str):
        return ''
    # Strip leading/trailing whitespace and limit dangerous chars
    return value.strip().replace('\x00', '')


def validate_email(email: str) -> bool:
    """Validate email address format using a strict regex."""
    pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email)) and len(email) <= 254


def validate_name(name: str) -> bool:
    """Validate name field."""
    if not name or len(name) > app.config['MAX_NAME_LENGTH']:
        return False
    # Allow letters, spaces, hyphens, apostrophes, periods, unicode chars
    pattern = r"^[\w\s\-'.]{1,100}$"
    return bool(re.match(pattern, name, re.UNICODE))


def validate_subject(subject: str) -> bool:
    """Validate subject field."""
    return bool(subject) and len(subject) <= app.config['MAX_SUBJECT_LENGTH']


def validate_message(message: str) -> bool:
    """Validate message field."""
    return bool(message) and len(message) <= app.config['MAX_MESSAGE_LENGTH']


def validate_phone(phone: str) -> bool:
    """Validate optional phone number."""
    if not phone:
        return True  # Phone is optional
    pattern = r'^\+?[\d\s\-().]{7,20}$'
    return bool(re.match(pattern, phone))


# ─── Rate Limiting ────────────────────────────────────────────────────────────

def get_client_identifier(req) -> str:
    """Generate a hashed identifier for the client based on IP."""
    ip = req.headers.get('X-Forwarded-For', req.remote_addr or '').split(',')[0].strip()
    return hashlib.sha256(ip.encode()).hexdigest()


def is_rate_limited(client_id: str) -> bool:
    """Check if client has exceeded rate limit."""
    now = datetime.utcnow()
    window = timedelta(seconds=app.config['RATE_LIMIT_WINDOW'])
    limit = app.config['RATE_LIMIT_REQUESTS']

    if client_id not in rate_limit_store:
        rate_limit_store[client_id] = []

    # Prune old entries
    rate_limit_store[client_id] = [
        ts for ts in rate_limit_store[client_id]
        if now - ts < window
    ]

    if len(rate_limit_store[client_id]) >= limit:
        return True

    rate_limit_store[client_id].append(now)
    return False


def rate_limit(f):
    """Rate limiting decorator."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_id = get_client_identifier(request)
        if is_rate_limited(client_id):
            logger.warning("Rate limit exceeded for client: %s", client_id[:8])
            return jsonify({
                'success': False,
                'error': 'Too many requests. Please try again later.',
                'retry_after': app.config['RATE_LIMIT_WINDOW']
            }), 429
        return f(*args, **kwargs)
    return decorated_function


# ─── Email Service ────────────────────────────────────────────────────────────

class EmailService:
    """Handles SMTP email sending with proper security."""

    @staticmethod
    def build_html_body(name: str, email: str, subject: str,
                        message: str, phone: str = '') -> str:
        """Build a safe HTML email body."""
        # Escape special HTML characters to prevent XSS in email clients
        def escape_html(text):
            return (
                text.replace('&', '&amp;')
                    .replace('<', '&lt;')
                    .replace('>', '&gt;')
                    .replace('"', '&quot;')
                    .replace("'", '&#x27;')
            )

        phone_row = f"""
            <tr>
                <td style="padding:8px;font-weight:bold;background:#f4f4f4;">Phone</td>
                <td style="padding:8px;">{escape_html(phone)}</td>
            </tr>
        """ if phone else ''

        return f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1.0">
        </head>
        <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#333;border-bottom:2px solid #4CAF50;padding-bottom:10px;">
                New Contact Form Submission
            </h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                <tr>
                    <td style="padding:8px;font-weight:bold;background:#f4f4f4;">Name</td>
                    <td style="padding:8px;">{escape_html(name)}</td>
                </tr>
                <tr>
                    <td style="padding:8px;font-weight:bold;background:#f4f4f4;">Email</td>
                    <td style="padding:8px;">{escape_html(email)}</td>
                </tr>
                {phone_row}
                <tr>
                    <td style="padding:8px;font-weight:bold;background:#f4f4f4;">Subject</td>
                    <td style="padding:8px;">{escape_html(subject)}</td>
                </tr>
            </table>
            <h3 style="color:#333;">Message:</h3>
            <div style