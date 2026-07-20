from flask import Flask, request, jsonify, url_for, current_app
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, timezone
import secrets
import hashlib
import os

app = Flask(__name__)
app.config.setdefault("SQLALCHEMY_DATABASE_URI", os.getenv("DATABASE_URL", "sqlite:///app.db"))
app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
app.config.setdefault("PASSWORD_RESET_TOKEN_BYTES", 32)
app.config.setdefault("PASSWORD_RESET_TOKEN_TTL_MINUTES", 30)
app.config.setdefault("PASSWORD_RESET_EMAIL_SENDER", "no-reply@example.com")
app.config.setdefault("SERVER_NAME", os.getenv("SERVER_NAME"))  # optional, for url_for _external=True

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
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)  # SHA-256 hex
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True, index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("reset_tokens", lazy=True))


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def send_password_reset_email(recipient_email: str, reset_url: str) -> None:
    # Replace this stub with a real mail provider integration.
    current_app.logger.info("Password reset email to %s: %s", recipient_email, reset_url)


def initiate_password_reset(email: str):
    user = User.query.filter_by(email=email.lower().strip()).first()

    # Always return a generic response to avoid account enumeration.
    generic_response = {
        "message": "If an account with that email exists, a password reset link has been sent."
    }

    if not user:
        return jsonify(generic_response), 200

    # Optional: invalidate any prior unused reset tokens for this user.
    now = datetime.now(timezone.utc)
    PasswordResetToken.query.filter_by(user_id=user.id, used_at=None).update(
        {"used_at": now},
        synchronize_session=False,
    )

    plaintext_token = secrets.token_urlsafe(current_app.config["PASSWORD_RESET_TOKEN_BYTES"])
    token_hash = hash_reset_token(plaintext_token)
    expires_at = now + timedelta(minutes=current_app.config["PASSWORD_RESET_TOKEN_TTL_MINUTES"])

    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        used_at=None,
    )
    db.session.add(reset_record)
    db.session.commit()

    reset_url = url_for(
        "reset_password",
        token=plaintext_token,
        _external=True,
    )

    send_password_reset_email(user.email, reset_url)

    return jsonify(generic_response), 200


@app.route("/auth/password-reset/request", methods=["POST"])
def password_reset_request_route():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    if not email:
        return jsonify({"message": "If an account with that email exists, a password reset link has been sent."}), 200
    return initiate_password_reset(email)


@app.route("/auth/password-reset/confirm", methods=["POST"])
def reset_password():
    """
    Expects JSON:
    {
        "token": "...",
        "new_password": "..."
    }

    This validates the hashed token, checks expiry, and invalidates it after a single use.
    """
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    new_password = data.get("new_password") or ""

    if not token or not new_password:
        return jsonify({"error": "Invalid request."}), 400

    token_hash = hash_reset_token(token)
    now = datetime.now(timezone.utc)

    reset_record = (
        PasswordResetToken.query
        .filter_by(token_hash=token_hash, used_at=None)
        .filter(PasswordResetToken.expires_at > now)
        .first()
    )

    if not reset_record:
        return jsonify({"error": "Invalid or expired token."}), 400

    user = reset_record.user

    # Replace with your password hashing strategy (e.g., bcrypt).
    # This is a placeholder hash approach for completeness.
    import hashlib as _hashlib
    user.password_hash = _hashlib.pbkdf2_hmac(
        "sha256",
        new_password.encode("utf-8"),
        b"static-salt-replace-me",
        260000,
    ).hex()

    # Single-use invalidation
    reset_record.used_at = now

    db.session.commit()

    return jsonify({"message": "Password has been reset successfully."}), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)