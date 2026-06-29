import os
import re
import html
from datetime import datetime
from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from email.message import EmailMessage
import smtplib
import ssl

app = Flask(__name__)

# -------------------------
# Configuration (env-based)
# -------------------------
app.config["JSON_SORT_KEYS"] = False
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024  # 16KB max request body

SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "25"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "false").lower() in ("1", "true", "yes")
MAIL_FROM = os.getenv("MAIL_FROM", "no-reply@example.com")
MAIL_TO = os.getenv("MAIL_TO", "contact@example.com")
MAIL_SUBJECT_PREFIX = os.getenv("MAIL_SUBJECT_PREFIX", "[Contact Form]")

# -------------------------
# Rate Limiting
# -------------------------
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=[],
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
)

# -------------------------
# Validation / Sanitization
# -------------------------
NAME_RE = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ' .-]{2,100}$")
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
SUBJECT_RE = re.compile(r"^[^\r\n]{2,150}$", re.UNICODE)

def sanitize_text(value: str, max_len: int = 2000) -> str:
    value = (value or "").strip()
    value = value.replace("\x00", "")
    value = re.sub(r"[\r\n\t]+", " ", value)
    value = re.sub(r"\s{2,}", " ", value)
    value = value[:max_len]
    return html.escape(value, quote=True)

def sanitize_message(value: str, max_len: int = 5000) -> str:
    value = (value or "").replace("\x00", "")
    value = value.strip()
    value = value[:max_len]
    # Keep newlines for readability but escape HTML/script content
    return html.escape(value, quote=True)

def validate_payload(data: dict):
    errors = {}

    # Honeypot field (should remain empty)
    honeypot = data.get("website", "")
    if honeypot:
        errors["website"] = "Invalid submission."

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()

    if not name:
        errors["name"] = "Name is required."
    elif not NAME_RE.match(name):
        errors["name"] = "Name format is invalid."

    if not email:
        errors["email"] = "Email is required."
    elif not EMAIL_RE.match(email):
        errors["email"] = "Email format is invalid."

    if not subject:
        errors["subject"] = "Subject is required."
    elif not SUBJECT_RE.match(subject):
        errors["subject"] = "Subject must be 2-150 characters and cannot contain newlines."

    if not message:
        errors["message"] = "Message is required."
    elif len(message) < 10:
        errors["message"] = "Message must be at least 10 characters."
    elif len(message) > 5000:
        errors["message"] = "Message must be 5000 characters or fewer."

    if errors:
        return None, errors

    clean = {
        "name": sanitize_text(name, 100),
        "email": sanitize_text(email, 254),
        "subject": sanitize_text(subject, 150),
        "message": sanitize_message(message, 5000),
    }
    return clean, None

def send_contact_email(clean_data: dict, ip_address: str, user_agent: str):
    msg = EmailMessage()
    msg["From"] = MAIL_FROM
    msg["To"] = MAIL_TO
    msg["Reply-To"] = clean_data["email"]
    msg["Subject"] = f"{MAIL_SUBJECT_PREFIX} {clean_data['subject']}"

    submitted_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    body = (
        f"New contact form submission\n"
        f"---------------------------\n"
        f"Name: {clean_data['name']}\n"
        f"Email: {clean_data['email']}\n"
        f"Subject: {clean_data['subject']}\n"
        f"IP Address: {ip_address}\n"
        f"User-Agent: {user_agent}\n"
        f"Submitted At: {submitted_at}\n\n"
        f"Message:\n{clean_data['message']}\n"
    )
    msg.set_content(body)

    if SMTP_USE_TLS:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls(context=context)
            if SMTP_USERNAME:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            if SMTP_USERNAME:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)

@app.route("/contact", methods=["POST"])
@limiter.limit("5 per hour")
def contact():
    # Accept JSON or form-encoded payloads
    if request.is_json:
        data = request.get_json(silent=True) or {}
    else:
        data = request.form.to_dict(flat=True)

    clean_data, errors = validate_payload(data)
    if errors:
        # Return generic success for honeypot-triggered requests to avoid bot feedback loops
        if "website" in errors:
            return jsonify({"status": "ok", "message": "Thanks for your message."}), 200
        return jsonify({"status": "error", "errors": errors}), 400

    try:
        send_contact_email(
            clean_data=clean_data,
            ip_address=request.headers.get("X-Forwarded-For", request.remote_addr or "unknown"),
            user_agent=(request.headers.get("User-Agent", "unknown")[:512]),
        )
    except Exception:
        return jsonify({"status": "error", "message": "Unable to send message at this time."}), 503

    return jsonify({"status": "ok", "message": "Thanks for your message."}), 200

@app.errorhandler(429)
def ratelimit_handler(_):
    return jsonify({
        "status": "error",
        "message": "Too many submissions from this IP. Please try again later."
    }), 429

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))