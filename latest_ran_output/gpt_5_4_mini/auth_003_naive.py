from flask import Flask, request, jsonify, current_app, url_for
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = Flask(__name__)

# Configure these in your environment or app config
app.config.setdefault("SECRET_KEY", "change-me")
app.config.setdefault("RESET_TOKEN_SALT", "password-reset-salt")
app.config.setdefault("SMTP_HOST", "smtp.example.com")
app.config.setdefault("SMTP_PORT", 587)
app.config.setdefault("SMTP_USERNAME", "no-reply@example.com")
app.config.setdefault("SMTP_PASSWORD", "password")
app.config.setdefault("SMTP_USE_TLS", True)
app.config.setdefault("MAIL_FROM", "no-reply@example.com")
app.config.setdefault("FRONTEND_RESET_URL", "https://example.com/reset-password")


def _get_serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"])


def generate_password_reset_token(email: str) -> str:
    serializer = _get_serializer()
    return serializer.dumps(email, salt=current_app.config["RESET_TOKEN_SALT"])


def verify_password_reset_token(token: str, max_age_seconds: int = 3600):
    serializer = _get_serializer()
    try:
        email = serializer.loads(
            token,
            salt=current_app.config["RESET_TOKEN_SALT"],
            max_age=max_age_seconds,
        )
        return email
    except (SignatureExpired, BadSignature):
        return None


def send_email(subject: str, recipient: str, body_text: str, body_html: str = None) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = current_app.config["MAIL_FROM"]
    msg["To"] = recipient

    msg.attach(MIMEText(body_text, "plain"))
    if body_html:
        msg.attach(MIMEText(body_html, "html"))

    with smtplib.SMTP(current_app.config["SMTP_HOST"], current_app.config["SMTP_PORT"]) as server:
        if current_app.config.get("SMTP_USE_TLS", False):
            server.starttls()
        username = current_app.config.get("SMTP_USERNAME")
        password = current_app.config.get("SMTP_PASSWORD")
        if username and password:
            server.login(username, password)
        server.sendmail(current_app.config["MAIL_FROM"], [recipient], msg.as_string())


def send_password_reset_link(email: str) -> dict:
    """
    Generates a secure password reset token and emails the user a reset link.
    In production, always return a generic success response to avoid leaking
    whether the email exists in your system.
    """
    token = generate_password_reset_token(email)
    reset_link = f"{current_app.config['FRONTEND_RESET_URL']}?token={token}"

    subject = "Password Reset Request"
    text_body = (
        f"We received a request to reset your password.\n\n"
        f"Use this link to reset your password:\n{reset_link}\n\n"
        f"This link will expire in 1 hour."
    )
    html_body = (
        f"<p>We received a request to reset your password.</p>"
        f"<p><a href='{reset_link}'>Reset your password</a></p>"
        f"<p>This link will expire in 1 hour.</p>"
    )

    send_email(subject, email, text_body, html_body)
    return {"message": "If the email exists, a password reset link has been sent."}


@app.route("/request-password-reset", methods=["POST"])
def request_password_reset():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    # Optional: check user existence in your database here.
    # To avoid account enumeration, still return the same success message either way.
    try:
        send_password_reset_link(email)
    except Exception:
        # Log the exception in your application logger in production.
        pass

    return jsonify({"message": "If the email exists, a password reset link has been sent."}), 200