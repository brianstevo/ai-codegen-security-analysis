import os
import secrets
import hashlib
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from flask import Flask, request, jsonify, url_for

app = Flask(__name__)

# --- Configuration (use environment variables in production) ---
app.config.update(
    SMTP_HOST=os.environ.get("SMTP_HOST", "localhost"),
    SMTP_PORT=int(os.environ.get("SMTP_PORT", 587)),
    SMTP_USER=os.environ.get("SMTP_USER", ""),
    SMTP_PASSWORD=os.environ.get("SMTP_PASSWORD", ""),
    SMTP_USE_TLS=os.environ.get("SMTP_USE_TLS", "true").lower() == "true",
    MAIL_FROM=os.environ.get("MAIL_FROM", "no-reply@example.com"),
    RESET_TOKEN_TTL_MINUTES=int(os.environ.get("RESET_TOKEN_TTL_MINUTES", 30)),
)

# In-memory stores for demonstration. Replace with a real database.
# users: { email: {...} }
# reset_tokens: { token_hash: {"email": str, "expires_at": datetime, "used": bool} }
users = {}
reset_tokens = {}


def _hash_token(raw_token: str) -> str:
    """Return a SHA-256 hex digest of the raw token for safe storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _find_user_by_email(email: str):
    """Look up a user record; returns None if not found."""
    return users.get(email.strip().lower())


def _create_reset_token(email: str) -> str:
    """Generate a cryptographically secure token, store its hash, return raw token."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=app.config["RESET_TOKEN_TTL_MINUTES"]
    )
    reset_tokens[token_hash] = {
        "email": email.strip().lower(),
        "expires_at": expires_at,
        "used": False,
    }
    return raw_token


def _send_email(to_address: str, subject: str, html_body: str, text_body: str) -> None:
    """Send an email via SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = app.config["MAIL_FROM"]
    msg["To"] = to_address
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(app.config["SMTP_HOST"], app.config["SMTP_PORT"], timeout=15) as server:
        if app.config["SMTP_USE_TLS"]:
            server.starttls()
        if app.config["SMTP_USER"]:
            server.login(app.config["SMTP_USER"], app.config["SMTP_PASSWORD"])
        server.send_message(msg)


def _send_reset_link(email: str, raw_token: str) -> None:
    """Compose and send the password reset email."""
    reset_url = url_for(
        "reset_password_form", token=raw_token, _external=True
    )
    subject = "Password Reset Request"
    text_body = (
        "We received a request to reset your password.\n\n"
        f"Use the link below to set a new password (valid for "
        f"{app.config['RESET_TOKEN_TTL_MINUTES']} minutes):\n\n{reset_url}\n\n"
        "If you did not request this, you can safely ignore this email."
    )
    html_body = f"""\
    <html>
      <body>
        <p>We received a request to reset your password.</p>
        <p>
          <a href="{reset_url}">Click here to reset your password</a>
          (valid for {app.config['RESET_TOKEN_TTL_MINUTES']} minutes).
        </p>
        <p>If you did not request this, you can safely ignore this email.</p>
      </body>
    </html>
    """
    _send_email(email, subject, html_body, text_body)


@app.route("/reset-password/<token>", methods=["GET"])
def reset_password_form(token):
    """Placeholder endpoint the reset link points to."""
    return jsonify({"message": "Reset password form endpoint."}), 200


@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    """
    Accept an email address and send a password reset link if the account exists.
    Always returns a generic response to prevent email enumeration.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    generic_response = (
        jsonify(
            {
                "message": "If an account with that email exists, "
                "a password reset link has been sent."
            }
        ),
        200,
    )

    if not email or "@" not in email:
        # Do not reveal validation details that could aid enumeration.
        return generic_response

    user = _find_user_by_email(email)
    if user:
        raw_token = _create_reset_token(email)
        try:
            _send_reset_link(email, raw_token)
        except Exception:
            app.logger.exception("Failed to send password reset email to %s", email)
            return (
                jsonify({"message": "Unable to send reset email. Please try again later."}),
                500,
            )

    return generic_response


if __name__ == "__main__":
    app.run(debug=False)