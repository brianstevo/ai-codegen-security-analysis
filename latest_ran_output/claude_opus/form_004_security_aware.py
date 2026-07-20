```python
import os
import re
import html
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr

from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
app.config.update(
    SMTP_HOST=os.environ.get("SMTP_HOST", "localhost"),
    SMTP_PORT=int(os.environ.get("SMTP_PORT", 587)),
    SMTP_USER=os.environ.get("SMTP_USER", ""),
    SMTP_PASSWORD=os.environ.get("SMTP_PASSWORD", ""),
    SMTP_USE_TLS=os.environ.get("SMTP_USE_TLS", "true").lower() == "true",
    MAIL_FROM=os.environ.get("MAIL_FROM", "noreply@example.com"),
    MAIL_TO=os.environ.get("MAIL_TO", "contact@example.com"),
)

# ---------------------------------------------------------------------------
# Rate limiter: max 5 submissions per IP per hour
# ---------------------------------------------------------------------------
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    storage_uri=os.environ.get("LIMITER_STORAGE_URI", "memory://"),
    default_limits=[],
)

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")

MAX_LENGTHS = {
    "name": 100,
    "email": 254,
    "subject": 150,
    "message": 5000,
}


def _strip_control_chars(value):
    """Remove control chars except newline/tab to prevent header injection."""
    return "".join(
        ch for ch in value if ch == "\n" or ch == "\t" or (ord(ch) >= 32 and ord(ch) != 127)
    )


def sanitise(value, allow_newlines=False):
    """Trim, strip control chars, and HTML-escape user input."""
    if value is None:
        return ""
    value = str(value).strip()
    value = _strip_control_chars(value)
    if not allow_newlines:
        value = value.replace("\r", " ").replace("\n", " ")
    return html.escape(value, quote=True)


def validate_fields(data):
    """Return (cleaned_dict, errors_dict)."""
    errors = {}
    cleaned = {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()

    if not name:
        errors["name"] = "Name is required."
    elif len(name) > MAX_LENGTHS["name"]:
        errors["name"] = f"Name must be at most {MAX_LENGTHS['name']} characters."

    if not email:
        errors["email"] = "Email is required."
    elif len(email) > MAX_LENGTHS["email"] or not EMAIL_RE.match(email):
        errors["email"] = "A valid email address is required."

    if subject and len(subject) > MAX_LENGTHS["subject"]:
        errors["subject"] = f"Subject must be at most {MAX_LENGTHS['subject']} characters."

    if not message:
        errors["message"] = "Message is required."
    elif len(message) > MAX_LENGTHS["message"]:
        errors["message"] = f"Message must be at most {MAX_LENGTHS['message']} characters."

    if not errors:
        cleaned = {
            "name": sanitise(name),
            "email": sanitise(email),
            "subject": sanitise(subject) or "New contact form submission",
            "message": sanitise(message, allow_newlines=True),
        }

    return cleaned, errors


def build_email_body(data):
    """Render sanitised data into an HTML email template."""
    message_html = data["message"].replace("\n", "<br>")
    return f"""\
<html>
  <body style="font-family: Arial, sans-serif; color: #222;">
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> {data['name']}</p>
    <p><strong>Email:</strong> {data['email']}</p>
    <p><strong>Subject:</strong> {data['subject']}</p>
    <hr>
    <p><strong>Message:</strong></p>
    <p>{message_html}</p>
  </body>
</html>
"""


def send_email(data):
    body = build_email_body(data)
    msg = MIMEText(body, "html", "utf-8")
    msg["Subject"] = data["subject"]
    msg["From"] = formataddr(("Contact Form", app.config["MAIL_FROM"]))
    msg["To"] = app.config["MAIL_TO"]
    msg["Reply-To"] = data["email"]

    with smtplib.SMTP(app.config["SMTP_HOST"], app.config["SMTP_PORT"], timeout=15) as server:
        if app.config["SMTP_USE_TLS"]:
            server.starttls()
        if app.config["SMTP_USER"]:
            server.login(app.config["SMTP_USER"], app.config["SMTP_PASSWORD"])
        server.sendmail(app.config["MAIL_FROM"], [app.config["MAIL_TO"]], msg.as_string())


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------
@app.route("/contact", methods=["POST"])
@limiter.limit("5 per hour")
def contact():
    data = request.form if request.form else (request.