```python
import os
import re
import html
import logging
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib

from flask import Flask, request, jsonify, render_template_string
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me-in-production")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=[],                  # no global default; apply per-route
    storage_uri=os.environ.get("REDIS_URL", "memory://"),
)

# ---------------------------------------------------------------------------
# Email configuration (pulled from environment variables)
# ---------------------------------------------------------------------------

SMTP_HOST     = os.environ.get("SMTP_HOST", "smtp.example.com")
SMTP_PORT     = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER     = os.environ.get("SMTP_USER", "sender@example.com")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "password")
SMTP_USE_TLS  = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
MAIL_FROM     = os.environ.get("MAIL_FROM", "noreply@example.com")
MAIL_TO       = os.environ.get("MAIL_TO", "admin@example.com")

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

# Compiled patterns for re-use
_EMAIL_RE    = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
_NAME_RE     = re.compile(r"^[\w\s'\-\.]{1,100}$", re.UNICODE)
_PHONE_RE    = re.compile(r"^[\d\s\+\-\(\)\.]{7,20}$")


def sanitise_text(value: str, max_length: int = 5000) -> str:
    """
    Trim whitespace, truncate to max_length, then HTML-escape the result.
    This prevents XSS if the value is later embedded in HTML.
    """
    value = value.strip()[:max_length]
    return html.escape(value)


def validate_name(name: str) -> str | None:
    """Return an error string or None if valid."""
    if not name:
        return "Name is required."
    if len(name) > 100:
        return "Name must be 100 characters or fewer."
    if not _NAME_RE.match(name):
        return "Name contains invalid characters."
    return None


def validate_email(email: str) -> str | None:
    if not email:
        return "Email address is required."
    if len(email) > 254:
        return "Email address is too long."
    if not _EMAIL_RE.match(email):
        return "Email address is not valid."
    return None


def validate_phone(phone: str) -> str | None:
    """Phone is optional; validate only when provided."""
    if not phone:
        return None
    if not _PHONE_RE.match(phone):
        return "Phone number contains invalid characters."
    return None


def validate_subject(subject: str) -> str | None:
    if not subject:
        return "Subject is required."
    if len(subject) > 200:
        return "Subject must be 200 characters or fewer."
    return None


def validate_message(message: str) -> str | None:
    if not message:
        return "Message is required."
    if len(message) < 10:
        return "Message must be at least 10 characters."
    if len(message) > 5000:
        return "Message must be 5 000 characters or fewer."
    return None


# ---------------------------------------------------------------------------
# Email builder & sender
# ---------------------------------------------------------------------------

EMAIL_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Contact Form Submission</title></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:auto;">
  <h2 style="background:#2c7be5;color:#fff;padding:16px;border-radius:4px 4px 0 0;margin:0;">
    New Contact Form Submission
  </h2>
  <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;">
    <tr><th style="text-align:left;padding:10px;background:#f5f5f5;width:30%;">From</th>
        <td style="padding:10px;">{name} &lt;{email}&gt;</td></tr>
    <tr><th style="text-align:left;padding:10px;background:#f5f5f5;">Phone</th>
        <td style="padding:10px;">{phone}</td></tr>
    <tr><th style="text-align:left;padding:10px;background:#f5f5f5;">Subject</th>
        <td style="padding:10px;">{subject}</td></tr>
    <tr><th style="text-align:left;padding:10px;background:#f5f5f5;vertical-align:top;">Message</th>
        <td style="padding:10px;white-space:pre-wrap;">{message}</td></tr>
    <tr><th style="text-align:left;padding:10px;background:#f5f5f5;">Submitted at</th>
        <td style="padding:10px;">{timestamp}</td></tr>
    <tr><th style="text-align:left;padding:10px;background:#f5f5f5;">Sender IP</th>
        <td style="padding:10px;">{ip}</td></tr>
  </table>
  <p style="font-size:12px;color:#888;padding:8px;">
    This message was sent via the website contact form.
  </p>
</body>
</html>
"""

EMAIL_PLAIN_TEMPLATE = """\
New Contact Form Submission
===========================
From:      {name} <{email}>
Phone:     {phone}
Subject:   {subject}
Submitted: {timestamp}
IP:        {ip}

Message:
{message}
"""


def build_email(name: str, email: str, phone: str,
                subject: str, message: str, ip: str) -> MIMEMultipart:
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    phone_display = phone if phone else "Not provided"

    html_body = EMAIL_HTML_TEMPLATE.format(
        name=name, email=email, phone=phone_display,
        subject=subject, message=message,
        timestamp=timestamp, ip=ip,
    )
    plain_body = EMAIL_PLAIN_TEMPLATE.format(
        name=name, email=email, phone=phone_display,
        subject=subject, message=message,
        timestamp=timestamp, ip=ip,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[Contact Form] {subject}"
    msg["From"]    = MAIL_FROM
    msg["To"]      = MAIL_TO
    msg["Reply-To"] = email

    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body,  "html",  "utf-8"))
    return msg


def send_email(msg: MIMEMultipart) -> None:
    """Send via SMTP; raises smtplib.SMTP