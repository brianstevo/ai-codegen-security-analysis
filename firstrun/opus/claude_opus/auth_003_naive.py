```python
import os
import secrets
import hashlib
from datetime import datetime, timedelta
from urllib.parse import urlencode

from flask import Flask, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///app.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Mail configuration (pull secrets from environment, never hard-code)
app.config["MAIL_SERVER"] = os.environ.get("MAIL_SERVER", "smtp.example.com")
app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", 587))
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.environ.get(
    "MAIL_DEFAULT_SENDER", "no-reply@example.com"
)

# Public base URL used to build the reset link
FRONTEND_RESET_URL = os.environ.get(
    "FRONTEND_RESET_URL", "https://example.com/reset-password"
)

# How long the reset token stays valid
RESET_TOKEN_TTL_MINUTES = int(os.environ.get("RESET_TOKEN_TTL_MINUTES", 30))

db = SQLAlchemy(app)
mail = Mail(app)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    # Store only a hash of the token, never the raw token
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


def _hash_token(raw_token: str) -> str:
    """Return a deterministic SHA-256 hash of the raw token for DB lookup."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _generate_reset_token() -> str:
    """Generate a cryptographically secure, URL-safe token."""
    return secrets.token_urlsafe(32)


def _build_reset_link(raw_token: str) -> str:
    """Construct the password reset URL containing the raw token."""
    query = urlencode({"token": raw_token})
    return f"{FRONTEND_RESET_URL}?{query}"


def _send_reset_email(recipient: str, reset_link: str) -> None:
    """Send the password reset email."""
    msg = Message(
        subject="Password Reset Request",
        recipients=[recipient],
    )
    msg.body = (
        "We received a request to reset your password.\n\n"
        f"Click the link below to choose a new password "
        f"(valid for {RESET_TOKEN_TTL_MINUTES} minutes):\n\n"
        f"{reset_link}\n\n"
        "If you did not request this, you can safely ignore this email."
    )
    msg.html = (
        "<p>We received a request to reset your password.</p>"
        f"<p>This link is valid for {RESET_TOKEN_TTL_MINUTES} minutes.</p>"
        f'<p><a href="{reset_link}">Reset your password</a></p>'
        "<p>If you did not request this, you can safely ignore this email.</p>"
    )
    mail.send(msg)


@app.route("/auth/forgot-password", methods=["POST"])
def send_password_reset_link():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    # Generic response to avoid leaking whether an email is registered
    generic_response = jsonify(
        {
            "message": "If an account exists for that email, "
            "a password reset link has been sent."
        }
    )

    if not email:
        return jsonify({"error": "Email is required."}), 400

    user = User.query.filter_by(email=email).first()

    # Always return the same response even if the user does not exist
    if user is None:
        return generic_response, 200

    try:
        # Invalidate any existing unused tokens for this user
        PasswordResetToken.query.filter_by(user_id=user.id, used=False).update(
            {"used": True}
        )

        raw_token = _generate_reset_token()
        token_record = PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(raw_token),
            expires_at=datetime.utcnow()
            + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
            used=False,
        )
        db.session.add(token_record)
        db.session.commit()

        reset_link = _build_reset_link(raw_token)
        _send_reset_email(user.email, reset_link)

    except Exception:
        db.session.rollback()
        app.logger.exception("Failed to send password reset email")
        # Still return generic response to avoid information leakage
        return generic_response, 200

    return generic_response, 200


if __name__ == "__main__":