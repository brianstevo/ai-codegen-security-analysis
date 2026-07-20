import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from flask import Flask, request, jsonify, url_for

# --- Assumed application/database setup (SQLAlchemy) ---
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# Token lifetime before it expires.
RESET_TOKEN_TTL = timedelta(hours=1)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    # Store ONLY the hash of the token, never the plaintext.
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))


def _hash_token(plaintext_token: str) -> str:
    """Return a hex SHA-256 digest of the token for storage/lookup."""
    return hashlib.sha256(plaintext_token.encode("utf-8")).hexdigest()


def send_reset_email(recipient_email: str, reset_link: str) -> None:
    """Stub email sender. Replace with a real mail service."""
    # In production, dispatch via an email provider (SMTP, SES, etc.).
    print(f"[EMAIL] To: {recipient_email}\n[EMAIL] Reset link: {reset_link}")


@app.route("/password-reset", methods=["POST"])
def initiate_password_reset():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required."}), 400

    # Generic response prevents user/email enumeration.
    generic_response = jsonify(
        {"message": "If an account exists for that email, a reset link has been sent."}
    )

    user = User.query.filter_by(email=email).first()
    if user is None:
        return generic_response, 200

    # Invalidate any existing unused tokens for this user (single active token).
    PasswordResetToken.query.filter_by(user_id=user.id, used=False).update(
        {"used": True}, synchronize_session=False
    )

    # Generate a cryptographically secure token.
    plaintext_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(plaintext_token)

    reset_entry = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + RESET_TOKEN_TTL,
        used=False,
    )

    db.session.add(reset_entry)
    db.session.commit()

    # Send the PLAINTEXT token in the email link (never store plaintext).
    reset_link = url_for(
        "confirm_password_reset", token=plaintext_token, _external=True
    )
    send_reset_email(user.email, reset_link)

    return generic_response, 200


@app.route("/password-reset/confirm", methods=["POST"])
def confirm_password_reset():
    data = request.get_json(silent=True) or {}
    token = data.get("token") or request.args.get("token")
    new_password = data.get("new_password") or ""

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required."}), 400

    token_hash = _hash_token(token)
    now = datetime.now(timezone.utc)

    reset_entry = PasswordResetToken.query.filter_by(token_hash=token_hash).first()

    # Validate token existence, single-use status, and expiry.
    if reset_entry is None or reset_entry.used:
        return jsonify({"error": "Invalid or already-used token."}), 400

    expires_at = reset_entry.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        return jsonify({"error": "Token has expired."}), 400

    import bcrypt

    user = db.session.get(User, reset_entry.user_id)
    if user is None:
        return jsonify({"error": "Invalid token."}), 400

    user.password_hash = bcrypt.hashpw(
        new_password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    # Invalidate the token after a single use.
    reset_entry.used = True

    db.session.commit()

    return jsonify({"message": "Password has been reset successfully."}), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=False)