from flask import Flask, request, jsonify, url_for
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import smtplib
from email.mime.text import MIMEText
import os

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me")
app.config["RESET_TOKEN_SALT"] = os.environ.get("RESET_TOKEN_SALT", "password-reset-salt")
app.config["RESET_TOKEN_MAX_AGE"] = int(os.environ.get("RESET_TOKEN_MAX_AGE", "3600"))

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.example.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "no-reply@example.com")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "password")
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
FROM_EMAIL = os.environ.get("FROM_EMAIL", SMTP_USER)
FRONTEND_RESET_URL = os.environ.get("FRONTEND_RESET_URL", "https://example.com/reset-password")


def get_serializer():
    return URLSafeTimedSerializer(app.config["SECRET_KEY"])


def generate_reset_token(email: str) -> str:
    return get_serializer().dumps(email, salt=app.config["RESET_TOKEN_SALT"])


def verify_reset_token(token: str, max_age: int = None):
    try:
        return get_serializer().loads(
            token,
            salt=app.config["RESET_TOKEN_SALT"],
            max_age=max_age or app.config["RESET_TOKEN_MAX_AGE"],
        )
    except (BadSignature, SignatureExpired):
        return None


def send_email(to_email: str, subject: str, body: str) -> None:
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        if SMTP_USE_TLS:
            server.starttls()
        if SMTP_USER and SMTP_PASSWORD:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(FROM_EMAIL, [to_email], msg.as_string())


def send_password_reset_link(email: str) -> bool:
    """
    Generate a time-limited password reset link and email it to the user.
    Returns True if the email was sent successfully, False otherwise.
    """
    token = generate_reset_token(email)
    reset_link = f"{FRONTEND_RESET_URL}?token={token}"

    subject = "Password Reset Request"
    body = (
        f"Hello,\n\n"
        f"We received a request to reset your password.\n"
        f"Use the link below to reset it:\n\n"
        f"{reset_link}\n\n"
        f"This link will expire in {app.config['RESET_TOKEN_MAX_AGE']} seconds.\n\n"
        f"If you did not request a password reset, please ignore this email.\n"
    )

    try:
        send_email(email, subject, body)
        return True
    except Exception:
        return False


@app.route("/request-password-reset", methods=["POST"])
def request_password_reset():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    # In a real app, check whether the user exists in your database.
    # For security, always return a generic success response.
    send_password_reset_link(email)

    return jsonify({"message": "If the email exists in our system, a reset link has been sent."}), 200


@app.route("/reset-password/verify", methods=["POST"])
def verify_reset():
    data = request.get_json(silent=True) or {}
    token = data.get("token", "")

    email = verify_reset_token(token)
    if not email:
        return jsonify({"error": "Invalid or expired token"}), 400

    return jsonify({"message": "Token is valid", "email": email}), 200


if __name__ == "__main__":
    app.run(debug=True)