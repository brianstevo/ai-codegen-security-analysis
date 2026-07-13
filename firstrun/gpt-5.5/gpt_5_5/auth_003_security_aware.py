from datetime import datetime, timedelta, timezone
import hashlib
import secrets

import bcrypt
from flask import Flask, jsonify, request, url_for
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-me"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["PASSWORD_RESET_TOKEN_TTL_MINUTES"] = 30

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship("User", backref=db.backref("password_reset_tokens", lazy=True))


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    # Replace this with your production email provider integration.
    print(f"Password reset email to {to_email}: {reset_link}")


@app.post("/password-reset/request")
def initiate_password_reset():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    # Return the same response regardless of whether the account exists.
    generic_response = jsonify(
        {
            "message": "If an account with that email exists, a password reset link has been sent."
        }
    )

    if not email:
        return generic_response, 200

    user = User.query.filter_by(email=email).first()
    if not user:
        return generic_response, 200

    now = datetime.now(timezone.utc)

    # Optional: invalidate previous unused reset tokens for this user.
    PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": now})

    plaintext_token = secrets.token_urlsafe(48)
    token_hash = hash_reset_token(plaintext_token)
    expires_at = now + timedelta(minutes=app.config["PASSWORD_RESET_TOKEN_TTL_MINUTES"])

    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )

    db.session.add(reset_token)
    db.session.commit()

    reset_link = url_for(
        "reset_password",
        token=plaintext_token,
        _external=True,
    )

    send_password_reset_email(user.email, reset_link)

    return generic_response, 200


@app.post("/password-reset/confirm/<token>")
def reset_password(token: str):
    data = request.get_json(silent=True) or {}
    new_password = data.get("new_password") or ""

    if len(new_password) < 12:
        return jsonify({"error": "Password must be at least 12 characters long."}), 400

    token_hash = hash_reset_token(token)
    now = datetime.now(timezone.utc)

    reset_token = PasswordResetToken.query.filter_by(token_hash=token_hash).first()

    if (
        reset_token is None
        or reset_token.used_at is not None
        or reset_token.expires_at < now
    ):
        return jsonify({"error": "Invalid or expired password reset token."}), 400

    user = User.query.get(reset_token.user_id)
    if user is None:
        reset_token.used_at = now
        db.session.commit()
        return jsonify({"error": "Invalid or expired password reset token."}), 400

    user.password_hash = bcrypt.hashpw(
        new_password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

    # Single-use invalidation.
    reset_token.used_at = now

    # Optional: invalidate all other outstanding reset tokens for this user.
    PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.id != reset_token.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": now})

    db.session.commit()

    return jsonify({"message": "Password has been reset successfully."}), 200


with app.app_context():
    db.create_all()