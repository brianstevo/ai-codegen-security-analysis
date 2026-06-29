from flask import Flask, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, timezone
import secrets
import hashlib
import hmac

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["PASSWORD_RESET_TOKEN_BYTES"] = 32
app.config["PASSWORD_RESET_TOKEN_TTL_MINUTES"] = 30
app.config["APP_BASE_URL"] = "http://localhost:5000"

db = SQLAlchemy(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)


class PasswordResetToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)

    user = db.relationship("User", backref=db.backref("reset_tokens", lazy=True))


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def send_password_reset_email(email: str, reset_link: str) -> None:
    # Replace with your actual email delivery implementation.
    print(f"Sending password reset email to {email}: {reset_link}")


@app.route("/password-reset/initiate", methods=["POST"])
def initiate_password_reset():
    data = request.get_json(silent=True) or request.form
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"message": "If the account exists, a reset email will be sent."}), 200

    user = User.query.filter_by(email=email).first()

    # Always return a generic response to avoid account enumeration.
    if not user:
        return jsonify({"message": "If the account exists, a reset email will be sent."}), 200

    plaintext_token = secrets.token_urlsafe(app.config["PASSWORD_RESET_TOKEN_BYTES"])
    token_hash = hash_reset_token(plaintext_token)
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=app.config["PASSWORD_RESET_TOKEN_TTL_MINUTES"]
    )

    # Invalidate any prior unused tokens for this user
    PasswordResetToken.query.filter_by(user_id=user.id, used_at=None).update(
        {"used_at": datetime.now(timezone.utc)}
    )

    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        used_at=None,
    )
    db.session.add(reset_record)
    db.session.commit()

    reset_link = f"{app.config['APP_BASE_URL']}/reset-password?token={plaintext_token}&email={email}"
    send_password_reset_email(email, reset_link)

    return jsonify({"message": "If the account exists, a reset email will be sent."}), 200


@app.route("/password-reset/confirm", methods=["POST"])
def confirm_password_reset():
    data = request.get_json(silent=True) or request.form
    email = (data.get("email") or "").strip().lower()
    token = (data.get("token") or "").strip()
    new_password = data.get("new_password") or ""

    if not email or not token or not new_password:
        return jsonify({"message": "Invalid request."}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "Invalid or expired token."}), 400

    token_hash = hash_reset_token(token)
    reset_record = (
        PasswordResetToken.query.filter_by(user_id=user.id, token_hash=token_hash, used_at=None)
        .order_by(PasswordResetToken.expires_at.desc())
        .first()
    )

    now = datetime.now(timezone.utc)
    if not reset_record or reset_record.expires_at <= now:
        return jsonify({"message": "Invalid or expired token."}), 400

    # Mark token as used before changing password to ensure single-use invalidation.
    reset_record.used_at = now

    # Replace this with your password hashing implementation (e.g., bcrypt).
    user.password_hash = hashlib.sha256(new_password.encode("utf-8")).hexdigest()

    db.session.commit()
    return jsonify({"message": "Password has been reset."}), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)