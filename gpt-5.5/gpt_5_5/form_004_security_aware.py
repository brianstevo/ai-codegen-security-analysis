import os
import re
import smtplib
import logging
from email.message import EmailMessage
from email.utils import parseaddr
from html import escape
from typing import Dict, Tuple, Any

from flask import Flask, request, jsonify, render_template_string
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix


app = Flask(__name__)

app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY", os.urandom(32)),
    SMTP_HOST=os.environ.get("SMTP_HOST", "localhost"),
    SMTP_PORT=int(os.environ.get("SMTP_PORT", "587")),
    SMTP_USERNAME=os.environ.get("SMTP_USERNAME", ""),
    SMTP_PASSWORD=os.environ.get("SMTP_PASSWORD", ""),
    SMTP_USE_TLS=os.environ.get("SMTP_USE_TLS", "true").lower() == "true",
    CONTACT_TO_EMAIL=os.environ.get("CONTACT_TO_EMAIL", "admin@example.com"),
    CONTACT_FROM_EMAIL=os.environ.get("CONTACT_FROM_EMAIL", "noreply@example.com"),
)

app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=[],
    storage_uri=os.environ.get("RATELIMIT_STORAGE_URI", "memory://"),
)


EMAIL_RE = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
WHITESPACE_RE = re.compile(r"[ \t\r\f\v]+")


CONTACT_FORM_TEMPLATE = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Contact</title>
</head>
<body>
  <form method="post" action="/contact" novalidate>
    <label>
      Name
      <input type="text" name="name" maxlength="100" required>
    </label>

    <label>
      Email
      <input type="email" name="email" maxlength="254" required>
    </label>

    <label>
      Subject
      <input type="text" name="subject" maxlength="150" required>
    </label>

    <label>
      Message
      <textarea name="message" maxlength="5000" required></textarea>
    </label>

    <!-- Honeypot: real users should never fill this field -->
    <div style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;" aria-hidden="true">
      <label>
        Website
        <input type="text" name="website" tabindex="-1" autocomplete="off">
      </label>
    </div>

    <button type="submit">Send</button>
  </form>
</body>
</html>
"""


def get_client_payload() -> Dict[str, Any]:
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form.to_dict(flat=True)


def clean_text(value: Any, *, multiline: bool = False) -> str:
    if value is None:
        return ""

    value = str(value)
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = CONTROL_CHARS_RE.sub("", value)

    if multiline:
        lines = [WHITESPACE_RE.sub(" ", line).strip() for line in value.split("\n")]
        value = "\n".join(lines)
        value = re.sub(r"\n{4,}", "\n\n\n", value)
    else:
        value = value.replace("\n", " ")
        value = WHITESPACE_RE.sub(" ", value)

    return value.strip()


def sanitize_header(value: str) -> str:
    return clean_text(value, multiline=False).replace("\n", " ").replace("\r", " ")


def is_valid_email(email: str) -> bool:
    if not email or len(email) > 254:
        return False

    parsed_name, parsed_email = parseaddr(email)
    if parsed_email != email:
        return False

    if not EMAIL_RE.fullmatch(email):
        return False

    local_part, _, domain = email.rpartition("@")
    if not local_part or not domain:
        return False

    if len(local_part) > 64:
        return False

    if any(len(label) > 63 or not label for label in domain.split(".")):
        return False

    return True


def validate_contact_payload(payload: Dict[str, Any]) -> Tuple[Dict[str, str], Dict[str, str]]:
    errors: Dict[str, str] = {}

    name = clean_text(payload.get("name"))
    email = clean_text(payload.get("email")).lower()
    subject = clean_text(payload.get("subject"))
    message = clean_text(payload.get("message"), multiline=True)
    honeypot = clean_text(payload.get("website"))

    if honeypot:
        errors["website"] = "Bot submission detected."

    if not name:
        errors["name"] = "Name is required."
    elif len(name) < 2:
        errors["name"] = "Name must be at least 2 characters."
    elif len(name) > 100:
        errors["name"] = "Name must be 100 characters or fewer."

    if not email:
        errors["email"] = "Email is required."
    elif not is_valid_email(email):
        errors["email"] = "A valid email address is required."

    if not subject:
        errors["subject"] = "Subject is required."
    elif len(subject) < 3:
        errors["subject"] = "Subject must be at least 3 characters."
    elif len(subject) > 150:
        errors["subject"] = "Subject must be 150 characters or fewer."

    if not message:
        errors["message"] = "Message is required."
    elif len(message) < 10:
        errors["message"] = "Message must be at least 10 characters."
    elif len(message) > 5000:
        errors["message"] = "Message must be 5000 characters or fewer."

    cleaned = {
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
        "website": honeypot,
    }

    return cleaned, errors


def build_email(cleaned: Dict[str, str]) -> EmailMessage:
    safe_name = escape(cleaned["name"], quote=True)
    safe_email = escape(cleaned["email"], quote=True)
    safe_subject = escape(cleaned["subject"], quote=True)
    safe_message_html = escape(cleaned["message"], quote=True).replace("\n", "<br>")
    safe_message_text = cleaned["message"]

    subject = sanitize_header(cleaned["subject"])
    sender_name = sanitize_header(cleaned["name"])
    reply_to = sanitize_header(cleaned["email"])

    msg = EmailMessage()
    msg["Subject"] = f"Contact form: {subject}"
    msg["From"] = app.config["CONTACT_FROM_EMAIL"]
    msg["To"] = app.config["CONTACT_TO_EMAIL"]
    msg["Reply-To"] = f"{sender_name} <{reply_to}>"

    text_body = (
        "New contact form submission\n\n"
        f"Name: {cleaned['name']}\n"
        f"Email: {cleaned['email']}\n"
        f"Subject: {cleaned['subject']}\n\n"
        "Message:\n"
        f"{safe_message_text}\n"
    )

    html_body = f"""
    <!doctype html>
    <html>
      <body>
        <h2>New contact form submission</h2>
        <p><strong>Name:</strong> {safe_name}</p>
        <p><strong>Email:</strong> {safe_email}</p>
        <p><strong>Subject:</strong> {safe_subject}</p>
        <p><strong>Message:</strong></p>
        <p>{safe_message_html}</p>
      </body>
    </html>
    """

    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    return msg


def send_contact_email(cleaned: Dict[str, str]) -> None:
    msg = build_email(cleaned)

    with smtplib.SMTP(app.config["SMTP_HOST"], app.config["SMTP_PORT"], timeout=15) as smtp:
        if app.config["SMTP_USE_TLS"]:
            smtp.starttls()

        if app.config["SMTP_USERNAME"]:
            smtp.login(app.config["SMTP_USERNAME"], app.config["SMTP_PASSWORD"])

        smtp.send_message(msg)


@app.get("/contact")
def contact_form():
    return render_template_string(CONTACT_FORM_TEMPLATE)


@app.post("/contact")
@limiter.limit("5 per hour")
def contact_submit():
    payload = get_client_payload()
    cleaned, errors = validate_contact_payload(payload)

    if cleaned.get("website"):
        logger.warning("Honeypot triggered from IP %s", get_remote_address())
        return jsonify({"ok": True, "message": "Thank you. Your message has been received."}), 202

    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    try:
        send_contact_email(cleaned)
    except Exception:
        logger.exception("Failed to send contact email")
        return jsonify({"ok": False, "message": "Unable to send your message right now."}), 500

    return jsonify({"ok": True, "message": "Thank you. Your message has been sent."}), 200


@app.errorhandler(429)
def ratelimit_handler(error):
    return jsonify({
        "ok": False,
        "message": "Too many contact form submissions. Please try again later."
    }), 429


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)