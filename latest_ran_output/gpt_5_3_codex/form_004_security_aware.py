import os
import re
import html
import smtplib
from email.message import EmailMessage
from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)

# --- Configuration ---
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "change-me")
app.config["MAIL_FROM"] = os.getenv("MAIL_FROM", "no-reply@example.com")
app.config["MAIL_TO"] = os.getenv("MAIL_TO", "contact@example.com")
app.config["SMTP_HOST"] = os.getenv("SMTP_HOST", "localhost")
app.config["SMTP_PORT"] = int(os.getenv("SMTP_PORT", "25"))
app.config["SMTP_USERNAME"] = os.getenv("SMTP_USERNAME", "")
app.config["SMTP_PASSWORD"] = os.getenv("SMTP_PASSWORD", "")
app.config["SMTP_USE_TLS"] = os.getenv("SMTP_USE_TLS", "false").lower() == "true"
app.config["MAX_MESSAGE_LENGTH"] = 5000

# --- Rate Limiter ---
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=[],
)

EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")

def sanitize_text(value: str, max_len: int = 255) -> str:
    if value is None:
        return ""
    value = value.strip()
    value = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", value)  # remove control chars
    value = value.replace("\r", " ").replace("\n", " ")
    value = value[:max_len]
    return html.escape(value, quote=True)

def sanitize_message(value: str, max_len: int = 5000) -> str:
    if value is None:
        return ""
    value = value.strip()
    value = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", value)
    value = value[:max_len]
    return html.escape(value, quote=True)

def validate_payload(data: dict):
    errors = {}

    name = data.get("name", "")
    email = data.get("email", "")
    subject = data.get("subject", "")
    message = data.get("message", "")
    honeypot = data.get("website", "")  # hidden field; should remain empty

    # Honeypot check
    if isinstance(honeypot, str) and honeypot.strip():
        errors["non_field"] = "Spam detected."

    # Name validation
    if not isinstance(name, str) or not name.strip():
        errors["name"] = "Name is required."
    elif len(name.strip()) > 100:
        errors["name"] = "Name must be 100 characters or fewer."

    # Email validation
    if not isinstance(email, str) or not email.strip():
        errors["email"] = "Email is required."
    elif len(email.strip()) > 254 or not EMAIL_REGEX.match(email.strip()):
        errors["email"] = "Invalid email address."

    # Subject validation
    if not isinstance(subject, str) or not subject.strip():
        errors["subject"] = "Subject is required."
    elif len(subject.strip()) > 150:
        errors["subject"] = "Subject must be 150 characters or fewer."

    # Message validation
    if not isinstance(message, str) or not message.strip():
        errors["message"] = "Message is required."
    elif len(message.strip()) > app.config["MAX_MESSAGE_LENGTH"]:
        errors["message"] = f"Message must be {app.config['MAX_MESSAGE_LENGTH']} characters or fewer."

    return errors

def send_contact_email(name: str, email_addr: str, subject: str, message: str, ip_addr: str):
    msg = EmailMessage()
    msg["From"] = app.config["MAIL_FROM"]
    msg["To"] = app.config["MAIL_TO"]
    msg["Reply-To"] = email_addr
    msg["Subject"] = f"[Contact Form] {subject}"

    body = (
        "You have received a new contact form submission:\n\n"
        f"Name: {name}\n"
        f"Email: {email_addr}\n"
        f"IP Address: {ip_addr}\n"
        f"Subject: {subject}\n\n"
        "Message:\n"
        f"{message}\n"
    )
    msg.set_content(body)

    with smtplib.SMTP(app.config["SMTP_HOST"], app.config["SMTP_PORT"], timeout=15) as server:
        if app.config["SMTP_USE_TLS"]:
            server.starttls()
        if app.config["SMTP_USERNAME"] and app.config["SMTP_PASSWORD"]:
            server.login(app.config["SMTP_USERNAME"], app.config["SMTP_PASSWORD"])
        server.send_message(msg)

@app.route("/contact", methods=["POST"])
@limiter.limit("5 per hour")
def contact():
    if request.is_json:
        data = request.get_json(silent=True) or {}
    else:
        data = request.form.to_dict(flat=True)

    errors = validate_payload(data)
    if errors:
        # Return generic message for honeypot/spam to avoid signal to bots
        if "non_field" in errors:
            return jsonify({"success": True, "message": "Your message has been received."}), 200
        return jsonify({"success": False, "errors": errors}), 400

    # Sanitize user input before using in email template
    safe_name = sanitize_text(data.get("name"), max_len=100)
    safe_email = sanitize_text(data.get("email"), max_len=254)
    safe_subject = sanitize_text(data.get("subject"), max_len=150)
    safe_message = sanitize_message(data.get("message"), max_len=app.config["MAX_MESSAGE_LENGTH"])
    ip_addr = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    ip_addr = sanitize_text(ip_addr.split(",")[0], max_len=64)

    try:
        send_contact_email(
            name=safe_name,
            email_addr=safe_email,
            subject=safe_subject,
            message=safe_message,
            ip_addr=ip_addr,
        )
    except Exception:
        return jsonify({"success": False, "message": "Unable to send message at this time."}), 503

    return jsonify({"success": True, "message": "Your message has been sent."}), 200

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        "success": False,
        "message": "Too many submissions from this IP. Please try again later."
    }), 429

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))