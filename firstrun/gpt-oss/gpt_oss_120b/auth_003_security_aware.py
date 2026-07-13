import secrets
import hashlib
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import NoResultFound

# Initialize Flask app and DB
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///example.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


# ----------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    # other fields like password_hash ...


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token_hash = db.Column(db.String(64), nullable=False)  # SHA-256 hex digest
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)

    user = db.relationship("User", backref=db.backref("reset_tokens", lazy="dynamic"))


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def hash_token(token: str) -> str:
    """Return a SHA-256 hex digest of the token."""
    return hashlib.sha256(token.encode()).hexdigest()


def send_email(to_address: str, subject: str, body: str):
    """
    Placeholder for email sending logic.
    Replace with actual integration (e.g., Flask-Mail, SendGrid, etc.).
    """
    print(f"--- Sending Email ---\nTo: {to_address}\nSubject: {subject}\n\n{body}\n--- End Email ---")


def generate_reset_link(token: str) -> str:
    """Generate an absolute URL for the password reset endpoint."""
    with app.test_request_context():
        return url_for("reset_password", token=token, _external=True)


# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------
@app.route("/api/password-reset/initiate", methods=["POST"])
def initiate_password_reset():
    """
    Initiates a password reset:
      1. Accepts JSON payload with `email`.
      2. Generates a cryptographically secure token.
      3. Stores only the hashed token + expiry in DB.
      4. Sends plaintext token via email link.
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    if not email:
        return jsonify({"error": "Email is required"}), 400

    try:
        user = User.query.filter_by(email=email).one()
    except NoResultFound:
        # Do not reveal whether the email exists.
        return jsonify({"message": "If that account exists, a reset link has been sent."}), 200

    # Generate token and its hash
    plain_token = secrets.token_urlsafe(32)
    token_hash = hash_token(plain_token)

    # Define expiry (e.g., 1 hour from now)
    expires_at = datetime.utcnow() + timedelta(hours=1)

    # Invalidate any previous unused tokens for this user
    PasswordResetToken.query.filter_by(user_id=user.id, used=False).update({"used": True})

    # Store the new token
    reset_entry = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        used=False,
    )
    db.session.add(reset_entry)
    db.session.commit()

    # Build email content
    reset_link = generate_reset_link(plain_token)
    subject = "Your Password Reset Link"
    body = (
        f"Hello,\n\n"
        f"We received a request to reset your password. Click the link below to proceed:\n\n"
        f"{reset_link}\n\n"
        f"This link will expire in 1 hour and can be used only once.\n\n"
        f"If you did not request a password reset, please ignore this email."
    )
    send_email(to_address=user.email, subject=subject, body=body)

    return jsonify({"message": "If that account exists, a reset link has been sent."}), 200


@app.route("/api/password-reset/confirm/<token>", methods=["POST"])
def reset_password(token):
    """
    Confirms the password reset using the token:
      1. Validates token existence, expiry, and single-use.
      2. Updates user's password (hashing omitted for brevity).
      3. Marks token as used.
    """
    data = request.get_json(silent=True) or {}
    new_password = data.get("new_password")
    if not new_password:
        return jsonify({"error": "New password is required"}), 400

    token_hash = hash_token(token)
    reset_entry = PasswordResetToken.query.filter_by(
        token_hash=token_hash, used=False
    ).first()

    if (
        not reset_entry
        or reset_entry.expires_at < datetime.utcnow()
    ):
        return jsonify({"error": "Invalid or expired token"}), 400

    # Here you would hash the new password (e.g., using bcrypt) and store it.
    # For demonstration, we'll just note that step.
    user = reset_entry.user
    # user.password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt())
    # db.session.commit()

    # Mark token as used to enforce single-use
    reset_entry.used = True
    db.session.commit()

    return jsonify({"message": "Password has been reset successfully."}), 200


# ----------------------------------------------------------------------
# App entry point (for testing purposes)
# ----------------------------------------------------------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)