from flask import Flask, request, jsonify, current_app
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, timezone
import secrets
import hashlib
import smtplib
from email.message import EmailMessage

app = Flask(__name__)

# --- Example configuration (override with your real settings) ---
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["FRONTEND_URL"] = "http://localhost:3000"
app.config["RESET_TOKEN_TTL_MINUTES"] = 30
app.config["SMTP_HOST"] = "smtp.example.com"
app.config["SMTP_PORT"] = 587
app.config["SMTP_USERNAME"] = "no-reply@example.com"
app.config["SMTP_PASSWORD"] = "your-smtp-password"
app.config["SMTP_USE_TLS"] = True
app.config["MAIL_FROM"] = "no-reply@example.com"

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)  # sha256 hex
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    used = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = db.relationship("User", backref=db.backref("password_reset_tokens", lazy=True))


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _send_email(to_email: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = current_app.config["MAIL_FROM"]
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(current_app.config["SMTP_HOST"], current_app.config["SMTP_PORT"]) as server:
        if current_app.config.get("SMTP_USE_TLS", True):
            server.starttls()
        username = current_app.config.get("SMTP_USERNAME")
        password = current_app.config.get("SMTP_PASSWORD")
        if username and password:
            server.login(username, password)
        server.send_message(msg)


@app.post("/auth/forgot-password")
def send_password_reset_link():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    # Always return generic success to avoid account enumeration
    generic_response = {
        "message": "If that email is registered, a password reset link has been sent."
    }

    if not email:
        return jsonify(generic_response), 200

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify(generic_response), 200

    # Invalidate existing active tokens for this user
    now = datetime.now(timezone.utc)
    active_tokens = PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used.is_(False),
        PasswordResetToken.expires_at > now,
    ).all()
    for t in active_tokens:
        t.used = True

    # Generate secure token and store only hash
    raw_token = secrets.token_urlsafe(48)
    token_hash = _hash_token(raw_token)
    expires_at = now + timedelta(minutes=int(current_app.config["RESET_TOKEN_TTL_MINUTES"]))

    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        used=False,
    )
    db.session.add(reset_token)
    db.session.commit()

    reset_link = f"{current_app.config['FRONTEND_URL'].rstrip('/')}/reset-password?token={raw_token}"
    body = (
        f"Hi,\n\n"
        f"We received a request to reset your password.\n"
        f"Use the link below to reset it (valid for {current_app.config['RESET_TOKEN_TTL_MINUTES']} minutes):\n\n"
        f"{reset_link}\n\n"
        f"If you did not request this, you can ignore this email.\n"
    )

    try:
        _send_email(
            to_email=user.email,
            subject="Reset your password",
            body=body,
        )
    except Exception:
        # Do not leak email delivery failures to client
        current_app.logger.exception("Failed to send password reset email.")

    return jsonify(generic_response), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)