import hashlib
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from flask import Flask, request, jsonify, url_for

# Assumes SQLAlchemy models are available; adjust imports to your project.
from your_app import app, db
from your_app.models import User, PasswordResetToken

# --- Configuration ---
TOKEN_BYTES = 32                    # entropy for secrets.token_urlsafe
TOKEN_TTL_MINUTES = 30              # token expiry window
SMTP_HOST = app.config.get("SMTP_HOST", "localhost")
SMTP_PORT = app.config.get("SMTP_PORT", 25)
SMTP_USER = app.config.get("SMTP_USER")
SMTP_PASSWORD = app.config.get("SMTP_PASSWORD")
MAIL_FROM = app.config.get("MAIL_FROM", "no-reply@example.com")


def _hash_token(token: str) -> str:
    """Return a hex SHA-256 hash of the token. Only this is ever stored."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _send_reset_email(to_email: str, plaintext_token: str) -> None:
    """Send the plaintext token (in a link) to the user's email."""
    reset_link = url_for(
        "reset_password_confirm", token=plaintext_token, _external=True
    )
    msg = EmailMessage()
    msg["Subject"] = "Password Reset Request"
    msg["From"] = MAIL_FROM
    msg["To"] = to_email
    msg.set_content(
        "We received a request to reset your password.\n\n"
        f"Use the link below to reset it (valid for {TOKEN_TTL_MINUTES} minutes "
        "and usable only once):\n\n"
        f"{reset_link}\n\n"
        "If you did not request this, you can safely ignore this email."
    )

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        if SMTP_PORT in (587,):
            server.starttls()
            server.ehlo()
        if SMTP_USER and SMTP_PASSWORD:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)


@app.route("/password-reset", methods=["POST"])
def initiate_password_reset():
    """
    Initiate a password reset:
      - generate a cryptographically secure token
      - store only its hash + expiry
      - email the plaintext token link to the user
    Always returns a generic response to avoid user enumeration.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    generic_response = jsonify(
        {"message": "If an account exists for that email, a reset link has been sent."}
    )

    if not email:
        return generic_response, 200

    user = User.query.filter(db.func.lower(User.email) == email).first()

    # Don't reveal whether the account exists.
    if user is None:
        return generic_response, 200

    # Generate cryptographically secure plaintext token.
    plaintext_token = secrets.token_urlsafe(TOKEN_BYTES)
    token_hash = _hash_token(plaintext_token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_TTL_MINUTES)

    # Invalidate any existing (unused) tokens for this user.
    PasswordResetToken.query.filter_by(user_id=user.id, used=False).update(
        {"used": True}
    )

    reset_entry = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,   # only the hash is persisted
        expires_at=expires_at,
        used=False,
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(reset_entry)
    db.session.commit()

    try:
        _send_reset_email(user.email, plaintext_token)
    except Exception:
        app.logger.exception("Failed to send password reset email")
        # Avoid leaking failure details; still return generic message.

    return generic_response, 200


@app.route("/password-reset/confirm", methods=["POST"])
def reset_password_confirm():
    """
    Confirm a password reset using the plaintext token.
    Validates expiry and single-use, then invalidates the token.
    """
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or request.args.get("token") or "").strip()
    new_password = data.get("new_password") or ""

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required."}), 400

    token_hash = _hash_token(token)

    entry = PasswordResetToken.query.filter_by(token_hash=token_hash).first()

    now = datetime.now(timezone.utc)
    if (
        entry is None
        or entry.used
        or entry.expires_at.replace(tzinfo=timezone.utc) < now
    ):
        return jsonify({"error": "Invalid or expired token."}), 400

    user = User.query.get(entry.user_id)
    if user is None:
        return jsonify({"error": "Invalid or expired token."}), 400

    # Update password (assumes User.set_password handles secure hashing, e.g. bcrypt).
    user.set_password(new_password)

    # Invalidate token after single use.
    entry.used = True

    db.session.commit()

    return jsonify({"message": "Password has been reset successfully."}), 200