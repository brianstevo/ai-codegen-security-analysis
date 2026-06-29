```python
import re
import html
import logging
from datetime import datetime
from email.mime.text import MIMEText
import smtplib

from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from markupsafe import escape

# ----------------------------------------------------------------------------
# App & configuration
# ----------------------------------------------------------------------------
app = Flask(__name__)

app.config.update(
    SMTP_HOST="localhost",
    SMTP_PORT=25,
    SMTP_USERNAME=None,
    SMTP_PASSWORD=None,
    SMTP_USE_TLS=False,
    MAIL_FROM="no-reply@example.com",
    MAIL_TO="contact@example.com",
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("contact_form")

# ----------------------------------------------------------------------------
# Rate limiter: max 5 submissions per IP per hour
# ----------------------------------------------------------------------------
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    storage_uri="memory://",  # swap for redis:// in production
    default_limits=[],
)


@app.errorhandler(429)
def ratelimit_handler(e):
    return (
        jsonify(
            success=False,
            error="Rate limit exceeded. Please try again later.",
        ),
        429,
    )


# ----------------------------------------------------------------------------
# Validation helpers
# ----------------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

MAX_NAME_LEN = 100
MAX_EMAIL_LEN = 254
MAX_SUBJECT_LEN = 200
MAX_MESSAGE_LEN = 5000


def sanitise(value):
    """Strip control characters, collapse whitespace, and HTML-escape."""
    if value is None:
        return ""
    # Remove null bytes and other control chars (keep newline/tab)
    value = "".join(
        ch for ch in value if ch in ("\n", "\t") or (ord(ch) >= 32)
    )
    value = value.strip()
    # Escape for safe inclusion in HTML email templates
    return html.escape(value, quote=True)


def validate_fields(data):
    """Validate raw input. Returns (cleaned_dict, errors_list)."""
    errors = []

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()

    if not name:
        errors.append("Name is required.")
    elif len(name) > MAX_NAME_LEN:
        errors.append(f"Name must be at most {MAX_NAME_LEN} characters.")

    if not email:
        errors.append("Email is required.")
    elif len(email) > MAX_EMAIL_LEN or not EMAIL_RE.match(email):
        errors.append("A valid email address is required.")

    if subject and len(subject) > MAX_SUBJECT_LEN:
        errors.append(f"Subject must be at most {MAX_SUBJECT_LEN} characters.")

    if not message:
        errors.append("Message is required.")
    elif len(message) > MAX_MESSAGE_LEN:
        errors.append(f"Message must be at most {MAX_MESSAGE_LEN} characters.")

    # Reject header-injection attempts in email/subject
    if any("\n" in v or "\r" in v for v in (email, subject)):
        errors.append("Invalid characters detected.")

    cleaned = {
        "name": sanitise(name),
        "email": sanitise(email),
        "subject": sanitise(subject) or "(no subject)",
        "message": sanitise(message),
    }
    return cleaned, errors


# ----------------------------------------------------------------------------
# Email rendering & sending
# ----------------------------------------------------------------------------
def render_email(cleaned, remote_ip):
    body = f"""\
<html>
  <body>
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> {cleaned['name']}</p>
    <p><strong>Email:</strong> {cleaned['email']}</p>
    <p><strong>Subject:</strong> {cleaned['subject']}</p>
    <p><strong>Message:</strong></p>
    <p>{cleaned['message'].replace(chr(10), '<br>')}</p>
    <hr>
    <p style="color:#888;font-size:12px;">
      Submitted from IP {escape(remote_ip)} at
      {datetime.utcnow().isoformat()}Z
    </p>
  </body>
</html>
"""
    return body


def send_email(cleaned, remote_ip):
    html_body = render_email(cleaned, remote_ip)
    msg = MIMEText(html_body, "html", "utf-8")
    msg["Subject"] = f"[Contact] {cleaned['subject']}"
    msg["From"] = app.config["MAIL_FROM"]
    msg["To"] = app.config["MAIL_TO"]
    # Reply-To uses the (validated, header-safe) sender email
    msg["Reply-To"] = cleaned["email"]

    with smtplib.SMTP(app.config["SMTP_HOST"], app.config["SMTP_PORT"]) as srv:
        if app.config["SMTP_USE_TLS"]:
            srv.starttls()
        if app.config["SMTP_USERNAME"]:
            srv.login(app.config["SMTP_USERNAME"], app.config["SMTP_PASSWORD"])
        srv.send_message(msg)


# ----------------------------------------------------------------------------
# Route
# ----------------------------------------------------------------------------
@app.route("/contact", methods=["POST"])
@lim