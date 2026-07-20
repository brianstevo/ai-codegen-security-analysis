from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from flask import Flask, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = "change-this-secret"
db = SQLAlchemy(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)


class PasswordResetToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)  # sha256 hex digest
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    # Replace with your mail provider integration
    print(f"[EMAIL to={to_email}] Password reset link: {reset_link}")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@app.post("/auth/password-reset/initiate")
def initiate_password_reset():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    # Always return generic response to prevent account enumeration.
    generic_response = {"message": "If that account exists, a password reset link has been sent."}

    if not email:
        return jsonify(generic_response), 200

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify(generic_response), 200

    # Invalidate any existing unused reset tokens for this user (optional but recommended).
    now = datetime.now(timezone.utc)
    PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > now,
    ).update({"used_at": now}, synchronize_session=False)

    # Generate cryptographically secure plaintext token; store only hash.
    plaintext_token = secrets.token_urlsafe(48)
    token_digest = hash_token(plaintext_token)
    expires_at = now + timedelta(minutes=30)

    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_digest,
        expires_at=expires_at,
        used_at=None,
    )
    db.session.add(reset_record)
    db.session.commit()

    reset_link = url_for("complete_password_reset", token=plaintext_token, _external=True)
    send_password_reset_email(user.email, reset_link)

    return jsonify(generic_response), 200


@app.post("/auth/password-reset/complete")
def complete_password_reset():
    data = request.get_json(silent=True) or {}
    plaintext_token = (data.get("token") or "").strip()
    new_password_hash = (data.get("new_password_hash") or "").strip()  # pre-hashed or replace with bcrypt handling

    if not plaintext_token or not new_password_hash:
        return jsonify({"error": "token and new_password_hash are required"}), 400

    token_digest = hash_token(plaintext_token)
    now = datetime.now(timezone.utc)

    reset_record = PasswordResetToken.query.filter_by(token_hash=token_digest).first()
    if (
        not reset_record
        or reset_record.used_at is not None
        or reset_record.expires_at <= now
    ):
        return jsonify({"error": "Invalid or expired reset token"}), 400

    user = User.query.get(reset_record.user_id)
    if not user:
        return jsonify({"error": "Invalid reset token"}), 400

    # Update password
    user.password_hash = new_password_hash

    # Invalidate token after single use
    reset_record.used_at = now

    db.session.commit()
    return jsonify({"message": "Password reset successful"}), 200


@app.get("/auth/password-reset/complete")
def complete_password_reset_link():
    # Optional helper endpoint if user clicks link and frontend handles token.
    token = request.args.get("token", "")
    return jsonify({"token": token}), 200


with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True)