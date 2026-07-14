import secrets
import hashlib
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import bcrypt

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///example.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


# -------------------- Models --------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)


class PasswordResetToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    token_hash = db.Column(db.String(64), nullable=False)  # SHA-256 hex digest length
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)

    user = db.relationship("User", backref=db.backref("reset_tokens", lazy=True))


# -------------------- Helpers --------------------
def send_email(to_address: str, subject: str, body: str):
    """
    Placeholder email sender. Replace with real SMTP/email service.
    """
    print(f"--- Sending Email ---\nTo: {to_address}\nSubject: {subject}\n\n{body}\n--- End Email ---")


def hash_token(token: str) -> str:
    """Return a SHA-256 hex digest of the token."""
    return hashlib.sha256(token.encode()).hexdigest()


# -------------------- Routes --------------------
@app.route("/reset_password/initiate", methods=["POST"])
def initiate_password_reset():
    data = request.get_json()
    if not data or "email" not in data:
        return jsonify({"error": "Email required"}), 400

    user = User.query.filter_by(email=data["email"]).first()
    if not user:
        # Do not reveal that the email does not exist
        return jsonify({"message": "If the account exists, a reset link has been sent."}), 200

    # Generate token and hash it
    plain_token = secrets.token_urlsafe(32)
    token_hash = hash_token(plain_token)

    # Set expiry (e.g., 1 hour from now)
    expires_at = datetime.utcnow() + timedelta(hours=1)

    # Store hashed token
    reset_entry = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        used=False,
    )
    db.session.add(reset_entry)
    db.session.commit()

    # Build password reset link (adjust domain as needed)
    reset_link = url_for(
        "reset_password_verify",
        token=plain_token,
        _external=True,
    )

    # Send email
    subject = "Your Password Reset Link"
    body = f"Click the following link to reset your password (valid for 1 hour):\n{reset_link}"
    send_email(user.email, subject, body)

    return jsonify({"message": "If the account exists, a reset link has been sent."}), 200


@app.route("/reset_password/verify", methods=["POST"])
def reset_password_verify():
    """
    Expects JSON:
    {
        "token": "<plain token from email>",
        "new_password": "<new password>"
    }
    """
    data = request.get_json()
    if not data or "token" not in data or "new_password" not in data:
        return jsonify({"error": "Token and new password required"}), 400

    plain_token = data["token"]
    token_hash = hash_token(plain_token)

    reset_entry = (
        PasswordResetToken.query.filter_by(token_hash=token_hash)
        .order_by(PasswordResetToken.id.desc())
        .first()
    )

    if not reset_entry:
        return jsonify({"error": "Invalid or expired token"}), 400
    if reset_entry.used:
        return jsonify({"error": "Token has already been used"}), 400
    if datetime.utcnow() > reset_entry.expires_at:
        return jsonify({"error": "Token has expired"}), 400

    # Update user's password
    new_pw_hash = bcrypt.hashpw(
        data["new_password"].encode(), bcrypt.gensalt()
    ).decode()
    user = reset_entry.user
    user.password_hash = new_pw_hash

    # Invalidate token (single use)
    reset_entry.used = True

    db.session.commit()

    return jsonify({"message": "Password has been reset successfully"}), 200


# -------------------- App Init --------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)