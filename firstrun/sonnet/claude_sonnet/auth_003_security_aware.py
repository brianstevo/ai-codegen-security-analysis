```python
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['MAIL_SERVER'] = 'smtp.example.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'noreply@example.com'
app.config['MAIL_PASSWORD'] = 'your-mail-password'
app.config['MAIL_DEFAULT_SENDER'] = 'noreply@example.com'
app.config['FRONTEND_BASE_URL'] = 'https://yourapp.com'
app.config['RESET_TOKEN_EXPIRY_MINUTES'] = 30

db = SQLAlchemy(app)
mail = Mail(app)


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    reset_tokens = db.relationship('PasswordResetToken', back_populates='user',
                                   cascade='all, delete-orphan')


class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    used_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship('User', back_populates='reset_tokens')


def hash_token(plaintext_token: str) -> str:
    """Hash a token using SHA-256 for secure storage."""
    return hashlib.sha256(plaintext_token.encode('utf-8')).hexdigest()


def generate_reset_token() -> tuple[str, str, datetime]:
    """
    Generate a cryptographically secure reset token.
    Returns: (plaintext_token, hashed_token, expiry_datetime)
    """
    plaintext_token = secrets.token_urlsafe(32)
    hashed_token = hash_token(plaintext_token)
    expiry = datetime.now(timezone.utc) + timedelta(
        minutes=app.config['RESET_TOKEN_EXPIRY_MINUTES']
    )
    return plaintext_token, hashed_token, expiry


def send_reset_email(recipient_email: str, plaintext_token: str) -> None:
    """Send the password reset email containing the plaintext token in the link."""
    reset_url = (
        f"{app.config['FRONTEND_BASE_URL']}/reset-password"
        f"?token={plaintext_token}"
    )
    expiry_minutes = app.config['RESET_TOKEN_EXPIRY_MINUTES']

    msg = Message(
        subject='Password Reset Request',
        recipients=[recipient_email]
    )
    msg.body = (
        f"You requested a password reset for your account.\n\n"
        f"Click the link below to reset your password:\n\n"
        f"{reset_url}\n\n"
        f"This link will expire in {expiry_minutes} minutes.\n\n"
        f"If you did not request a password reset, please ignore this email. "
        f"Your password will remain unchanged.\n\n"
        f"For security, this link can only be used once."
    )
    msg.html = (
        f"<p>You requested a password reset for your account.</p>"
        f"<p><a href='{reset_url}'>Reset Your Password</a></p>"
        f"<p>This link will expire in <strong>{expiry_minutes} minutes</strong>.</p>"
        f"<p>If you did not request a password reset, please ignore this email.</p>"
        f"<p><small>For security, this link can only be used once.</small></p>"
    )
    mail.send(msg)


def invalidate_expired_tokens(user_id: int) -> None:
    """Proactively clean up old/expired tokens for a user."""
    now = datetime.now(timezone.utc)
    PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user_id,
        db.or_(
            PasswordResetToken.expires_at < now,
            PasswordResetToken.used == True
        )
    ).delete(synchronize_session=False)


@app.route('/api/auth/forgot-password', methods=['POST'])
def initiate_password_reset():
    """
    Endpoint to initiate a password reset.
    Accepts JSON: { "email": "user@example.com" }
    Always returns a generic success message to prevent user enumeration.
    """
    data = request.get_json(silent=True)

    if not data or 'email' not in data:
        return jsonify({
            'message': 'Email address is required.'
        }), 400

    email = data['email'].strip().lower()

    if not email or '@' not in email:
        return jsonify({
            'message': 'A valid email address is required.'
        }), 400

    # Generic response to prevent user enumeration attacks
    generic_response = jsonify({
        'message': (
            'If an account with that email exists, '
            'a password reset link has been sent.'
        )
    }), 200

    try:
        user = User.query.filter_by(email=email).first()

        # If no user found, return generic response without revealing this
        if not user:
            return generic_response

        # Clean up old tokens before creating a new one
        invalidate_expired_tokens(user.id)
        db.session.flush()

        # Generate a new secure token
        plaintext_token, hashed_token, expiry = generate_reset_token()

        # Store only the hashed token in the database
        reset_token_record = PasswordResetToken(
            user_id=user.id,
            token_hash=hashed_token,
            expires_at=expiry,
            used=False
        )
        db.session.add(reset_token_record)
        db.session.commit()

        # Send the plaintext token in the email link
        send_reset_email(user.email, plaintext_token)

        return generic_response

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Password reset initiation error: {e}")
        return jsonify({
            'message': 'An internal error occurred. Please try again later.'
        }), 500


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """
    Endpoint to complete the password reset using the token.
    Accepts JSON: { "token": "plaintext_token", "new_password": "new_pass" }
    Validates token, checks expiry, resets password, and invalidates token (single use).
    """
    import bcrypt

    data = request.get_json(silent=True)

    if not data or 'token' not in data or 'new_password' not in data:
        return jsonify({
            'message': 'Token and new password are required.'
        }), 400

    plaintext