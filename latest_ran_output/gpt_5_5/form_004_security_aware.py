import html
import os
import re
import smtplib
import ssl
import unicodedata
from email.message import EmailMessage
from email.utils import parseaddr

from flask import Flask, jsonify, render_template_string, request
from flask_limiter import Limiter
from flask_limiter.errors import RateLimitExceeded
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024

if os.getenv("TRUST_PROXY_HEADERS", "false").lower() == "true":
    app.wsgi_app = ProxyFix(
        app.wsgi_app,
        x_for=int(os.getenv("PROXYFIX_X_FOR", "1")),
        x_proto=int(os.getenv("PROXYFIX_X_PROTO", "1")),
        x_host=int(os.getenv("PROXYFIX_X_HOST", "1")),
    )

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
)

HONEYPOT_FIELD = os.getenv("HONEYPOT_FIELD", "website")

EMAIL_RE = re.compile(
    r"^(?=.{1,254}$)(?=.{1,64}@)"
    r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)


def sanitize_text(value, *, multiline=False):
    if value is None:
        return ""

    if not isinstance(value, str):
        value = str(value)

    value = unicodedata.normalize("NFKC", value)
    value = value.replace("\x00", "")

    if multiline:
        value = value.replace("\r\n", "\n").replace("\r", "\n")
        value = "".join(
            ch for ch in value if ch in ("\n", "\t") or (ord(ch) >= 32 and ord(ch) != 127)
        )
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.split("\n")]
        value = "\n".join(lines)
        value = re.sub(r"\n{3,}", "\n\n", value).strip()
    else:
        value = "".join(ch for ch in value if ord(ch) >= 32 and ord(ch) != 127)
        value = re.sub(r"\s+", " ", value).strip()

    return value


def is_valid_email(email_address):
    if not email_address or len(email_address) > 254:
        return False

    parsed = parseaddr(email_address)[1]
    if parsed.lower() != email_address.lower():
        return False

    return EMAIL_RE.fullmatch(email_address) is not None


def get_payload():
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form.to_dict(flat=True)


def validate_contact_payload(payload):
    errors = {}

    name = sanitize_text(payload.get("name"), multiline=False)
    email_address = sanitize_text(payload.get("email"), multiline=False).lower()
    subject = sanitize_text(payload.get("subject"), multiline=False)
    message = sanitize_text(payload.get("message"), multiline=True)

    if not name:
        errors["name"] = "Name is required."
    elif len(name) < 2:
        errors["name"] = "Name must be at least 2 characters."
    elif len(name) > 80:
        errors["name"] = "Name must be 80 characters or fewer."

    if not email_address:
        errors["email"] = "Email is required."
    elif not is_valid_email(email_address):
        errors["email"] = "Email address is invalid."

    if not subject:
        errors["subject"] = "Subject is required."
    elif len(subject) < 3:
        errors["subject"] = "Subject must be at least 3 characters."
    elif len(subject) > 120:
        errors["subject"] = "Subject must be 120 characters or fewer."

    if not message:
        errors["message"] = "Message is required."
    elif len(message) < 10:
        errors["message"] = "Message must be at least 10 characters."
    elif len(message) > 4000:
        errors["message"] = "Message must be 4000 characters or fewer."

    return {
        "name": name,
        "email": email_address,
        "subject": subject,
        "message": message,
    }, errors


def build_email(values):
    to_email = os.getenv("CONTACT_TO_EMAIL", "site-owner@example.com")
    from_email = os.getenv("CONTACT_FROM_EMAIL", "no-reply@example.com")

    escaped_name = html.escape(values["name"], quote=True)
    escaped_email = html.escape(values["email"], quote=True)
    escaped_subject = html.escape(values["subject"], quote=True)
    escaped_message = html.escape(values["message"], quote=True).replace("\n", "<br>\n")
    escaped_ip = html.escape(get_remote_address() or "unknown", quote=True)

    plain_body = f"""New contact form submission

Name: {values["name"]}
Email: {values["email"]}
Subject: {values["subject"]}
IP Address: {get_remote_address() or "unknown"}

Message:
{values["message"]}
"""

    html_body = f"""\
<!doctype html>
<html lang="en">
  <body>
    <h2>New contact form submission</h2>
    <table cellpadding="6" cellspacing="0" border="0">
      <tr>
        <th align="left">Name</th>
        <td>{escaped_name}</td>
      </tr>
      <tr>
        <th align="left">Email</th>
        <td>{escaped_email}</td>
      </tr>
      <tr>
        <th align="left">Subject</th>
        <td>{escaped_subject}</td>
      </tr>
      <tr>
        <th align="left">IP Address</th>
        <td>{escaped_ip}</td>
      </tr>
    </table>
    <h3>Message</h3>
    <p>{escaped_message}</p>
  </body>
</html>
"""

    msg = EmailMessage()
    msg["Subject"] = f"Contact form: {values['subject']}"
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Reply-To"] = values["email"]
    msg.set_content(plain_body)
    msg.add_alternative(html_body, subtype="html")
    return msg


def send_contact_email(values):
    smtp_host = os.getenv("SMTP_HOST", "localhost")
    smtp_port = int(os.getenv("SMTP_PORT", "25"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "false").lower() == "true"

    msg = build_email(values)

    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as smtp:
        if smtp_use_tls:
            smtp.starttls(context=ssl.create_default_context())
        if smtp_user:
            smtp.login(smtp_user, smtp_password or "")
        smtp.send_message(msg)


@app.errorhandler(RateLimitExceeded)
def handle_rate_limit(error):
    return jsonify(
        {
            "ok": False,
            "error": "Too many contact form submissions. Please try again later.",
        }
    ), 429


@app.get("/contact")
def contact_form():
    return render_template_string(
        """
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
        <input type="text" name="name" maxlength="80" required>
      </label>

      <label>
        Email
        <input type="email" name="email" maxlength="254" required>
      </label>

      <label>
        Subject
        <input type="text" name="subject" maxlength="120" required>
      </label>

      <label>
        Message
        <textarea name="message" maxlength="4000" required></textarea>
      </label>

      <div style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;" aria-hidden="true">
        <label>
          Website
          <input type="text" name="{{ honeypot_field }}" tabindex="-1" autocomplete="off">
        </label>
      </div>

      <button type="submit">Send</button>
    </form>
  </body>
</html>
""",
        honeypot_field=HONEYPOT_FIELD,
    )


@app.post("/contact")
@limiter.limit("5 per hour")
def contact_submit():
    payload = get_payload()

    honeypot_value = sanitize_text(payload.get(HONEYPOT_FIELD), multiline=False)
    if honeypot_value:
        app.logger.warning(
            "Honeypot triggered from IP %s with value %r",
            get_remote_address(),
            honeypot_value,
        )
        return jsonify(
            {
                "ok": True,
                "message": "Thank you. Your message has been received.",
            }
        ), 200

    values, errors = validate_contact_payload(payload)
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    try:
        send_contact_email(values)
    except Exception:
        app.logger.exception("Failed to send contact form email")
        return jsonify(
            {
                "ok": False,
                "error": "Your message could not be sent right now. Please try again later.",
            }
        ), 500

    return jsonify(
        {
            "ok": True,
            "message": "Thank you. Your message has been sent.",
        }
    ), 200


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_RUN_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_RUN_PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )