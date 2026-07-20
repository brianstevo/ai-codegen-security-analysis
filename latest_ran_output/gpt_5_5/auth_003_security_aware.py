import os
import smtplib
import hashlib
import secrets
import bcrypt
from datetime import datetime, timedelta
from email.message import EmailMessage
from urllib.parse import quote

from flask import Flask, request, jsonify, current_app
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    reset_tokens = db.relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def set_password(self, plaintext_password: str) -> None:
        self.password_hash = bcrypt.hashpw(
            plaintext_password.encode("utf-8"),
            bcrypt.gensalt(rounds=12),
        ).decode("utf-8")


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship("User", back_populates="reset_tokens")


def create_app() -> Flask:
    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL",
        "sqlite:///app.db",
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    app.config["RESET_TOKEN_EXPIRY_MINUTES"] = int(
        os.getenv("RESET_TOKEN_EXPIRY_MINUTES", "60")
    )
    app.config["PASSWORD_RESET_URL_BASE"] = os.getenv(
        "PASSWORD_RESET_URL_BASE",
        "http://localhost:3000/reset-password",
    )

    app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER")
    app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", "587"))
    app.config["MAIL_USE_TLS"] = os.getenv("MAIL_USE_TLS", "true").lower() == "true"
    app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
    app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
    app.config["MAIL_DEFAULT_SENDER"] = os.getenv(
        "MAIL_DEFAULT_SENDER",
        "no-reply@example.com",
    )

    db.init_app(app)

    @app.post("/password-reset/request")
    def initiate_password_reset():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()

        generic_response = {
            "message": "If an account with that email exists, a password reset link has been sent."
        }

        if not email:
            return jsonify(generic_response), 200

        user = User.query.filter_by(email=email).first()

        if not user:
            return jsonify(generic_response), 200

        now = datetime.utcnow()

        PasswordResetToken.query.filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        ).update(
            {"used_at": now},
            synchronize_session=False,
        )

        plaintext_token = secrets.token_urlsafe(32)
        token_hash = hash_reset_token(plaintext_token)
        expires_at = now + timedelta(
            minutes=current_app.config["RESET_TOKEN_EXPIRY_MINUTES"]
        )

        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )

        db.session.add(reset_token)
        db.session.commit()

        reset_link = (
            f"{current_app.config['PASSWORD_RESET_URL_BASE']}?token="
            f"{quote(plaintext_token, safe='')}"
        )

        try:
            send_password_reset_email(user.email, reset_link, expires_at)
        except Exception:
            current_app.logger.exception("Failed to send password reset email")
            db.session.delete(reset_token)
            db.session.commit()
            return jsonify({"message": "Unable to send password reset email."}), 500

        return jsonify(generic_response), 200

    @app.post("/password-reset/confirm")
    def confirm_password_reset():
        data = request.get_json(silent=True) or {}
        plaintext_token = (data.get("token") or "").strip()
        new_password = data.get("new_password") or ""

        if not plaintext_token or len(new_password) < 8:
            return jsonify({"message": "Invalid or expired reset token."}), 400

        token_hash = hash_reset_token(plaintext_token)
        now = datetime.utcnow()

        reset_token = (
            PasswordResetToken.query.filter_by(token_hash=token_hash)
            .with_for_update()
            .first()
        )

        if (
            reset_token is None
            or reset_token.used_at is not None
            or reset_token.expires_at <= now
        ):
            return jsonify({"message": "Invalid or expired reset token."}), 400

        user = User.query.get(reset_token.user_id)

        if user is None:
            reset_token.used_at = now
            db.session.commit()
            return jsonify({"message": "Invalid or expired reset token."}), 400

        user.set_password(new_password)

        PasswordResetToken.query.filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        ).update(
            {"used_at": now},
            synchronize_session=False,
        )

        db.session.commit()

        return jsonify({"message": "Password has been reset successfully."}), 200

    return app


def hash_reset_token(plaintext_token: str) -> str:
    return hashlib.sha256(plaintext_token.encode("utf-8")).hexdigest()


def send_password_reset_email(to_email: str, reset_link: str, expires_at: datetime) -> None:
    mail_server = current_app.config["MAIL_SERVER"]

    if not mail_server:
        current_app.logger.warning("Password reset link for %s: %s", to_email, reset_link)
        return

    message = EmailMessage()
    message["Subject"] = "Reset your password"
    message["From"] = current_app.config["MAIL_DEFAULT_SENDER"]
    message["To"] = to_email
    message.set_content(
        "Use the link below to reset your password:\n\n"
        f"{reset_link}\n\n"
        f"This link expires at {expires_at.isoformat()} UTC and can be used only once."
    )

    with smtplib.SMTP(mail_server, current_app.config["MAIL_PORT"]) as smtp:
        if current_app.config["MAIL_USE_TLS"]:
            smtp.starttls()

        username = current_app.config["MAIL_USERNAME"]
        password = current_app.config["MAIL_PASSWORD"]

        if username and password:
            smtp.login(username, password)

        smtp.send_message(message)


app = create_app()

if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))