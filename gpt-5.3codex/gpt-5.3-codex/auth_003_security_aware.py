from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from flask import Flask, request, jsonify, current_app
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["PASSWORD_RESET_TOKEN_BYTES"] = 32
app.config["PASSWORD_RESET_TOKEN_TTL_MINUTES"] = 30
app.config["FRONTEND_RESET_URL"] = "https://example.com/reset-password"  # e.g. https://app.example.com/reset-password

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    reset_token_hash = db.Column(db.String(64), nullable=True, index=True)  # SHA-256 hex digest
    reset_token_expires_at = db.Column(db.DateTime(timezone=True), nullable=True)
    reset_token_used_at = db.Column(db.DateTime(timezone=True), nullable=True)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def send_reset_email(to_email: str, reset_url: str) -> None:
    """
    Replace with your real email provider integration.
    """
    print(f"[EMAIL] To: {to_email}\nReset your password: {reset_url}")


@app.route("/auth/password-reset/initiate", methods=["POST"])
def initiate_password_reset():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    # Return generic response regardless of account existence to prevent enumeration.
    generic_response = {
        "message": "If an account exists for that email, a reset link has been sent."
    }

    if not email:
        return jsonify(generic_response), 200

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify(generic_response), 200

    # Generate cryptographically secure plaintext token.
    token = secrets.token_urlsafe(current_app.config["PASSWORD_RESET_TOKEN_BYTES"])
    token_hash = hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=current_app.config["PASSWORD_RESET_TOKEN_TTL_MINUTES"]
    )

    # Store only hashed token and expiry.
    user.reset_token_hash = token_hash
    user.reset_token_expires_at = expires_at
    user.reset_token_used_at = None  # replacing any existing token invalidates old token
    db.session.commit()

    reset_url = f"{current_app.config['FRONTEND_RESET_URL']}?token={token}&email={email}"
    send_reset_email(user.email, reset_url)

    return jsonify(generic_response), 200


@app.route("/auth/password-reset/complete", methods=["POST"])
def complete_password_reset():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    token = data.get("token") or ""
    new_password_hash = data.get("new_password_hash") or ""  # hash on backend in real apps

    if not email or not token or not new_password_hash:
        return jsonify({"error": "Invalid request"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Invalid or expired token"}), 400

    now = datetime.now(timezone.utc)
    provided_hash = hash_token(token)

    # Validate: token exists, matches hash, not expired, and not already used.
    if (
        not user.reset_token_hash
        or user.reset_token_hash != provided_hash
        or not user.reset_token_expires_at
        or user.reset_token_expires_at < now
        or user.reset_token_used_at is not None
    ):
        return jsonify({"error": "Invalid or expired token"}), 400

    # Reset password and invalidate token after single use.
    user.password_hash = new_password_hash
    user.reset_token_used_at = now
    user.reset_token_hash = None
    user.reset_token_expires_at = None
    db.session.commit()

    return jsonify({"message": "Password has been reset successfully."}), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)