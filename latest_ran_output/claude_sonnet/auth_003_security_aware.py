```python
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message

app = Flask(__name__)

# Configuration
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


# Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship to password reset tokens
    reset_tokens = db.relationship(
        'PasswordResetToken',
        back_populates='user',
        cascade='all, delete-orphan',
        lazy='dynamic'
    )


class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    # Store only the hashed version of the token
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    used_at = db.Column(db.DateTime, nullable=True)

    # Relationship back to user
    user = db.relationship('User', back_populates='reset_tokens')

    def is_valid(self) -> bool:
        """Check if the token is still valid (not used and not expired)."""
        now = datetime.now(timezone.utc)
        expires_at = self.expires_at
        # Ensure timezone-aware comparison
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return not self.used and expires_at > now


def hash_token(plaintext_token: str) -> str:
    """Hash a plaintext token using SHA-256 for secure storage."""
    return hashlib.sha256(plaintext_token.encode('utf-8')).hexdigest()


def send_reset_email(recipient_email: str, reset_token: str) -> None:
    """Send password reset email with the plaintext token in the link."""
    base_url = app.config['FRONTEND_BASE_URL']
    reset_link = f"{base_url}/reset-password?token={reset_token}"
    expiry_minutes = app.config['RESET_TOKEN_EXPIRY_MINUTES']

    subject = "Password Reset Request"
    body_text = (
        f"You requested a password reset.\n\n"
        f"Click the link below to reset your password. "
        f"This link will expire in {expiry_minutes} minutes and can only be used once.\n\n"
        f"{reset_link}\n\n"
        f"If you did not request this, please ignore this email and your password will remain unchanged.\n\n"
        f"For security, never share this link with anyone."
    )
    body_html = f"""
    <html>
      <body>
        <p>You requested a password reset.</p>
        <p>Click the button below to reset your password.
           This link will expire in <strong>{expiry_minutes} minutes</strong>
           and can only be used <strong>once</strong>.</p>
        <p>
          <a href="{reset_link}"
             style="background-color:#4CAF50;color:white;padding:12px 24px;
                    text-decoration:none;border-radius:4px;display:inline-block;">
            Reset My Password
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="{reset_link}">{reset_link}</a></p>
        <hr>
        <p><small>If you did not request this, please ignore this email.
           Your password will remain unchanged.</small></p>
      </body>
    </html>
    """

    msg = Message(
        subject=subject,
        recipients=[recipient_email],
        body=body_text,
        html=body_html
    )
    mail.send(msg)


def invalidate_existing_tokens(user_id: int) -> None:
    """Invalidate all existing unused reset tokens for a user."""
    now = datetime.now(timezone.utc)
    (
        PasswordResetToken.query
        .filter_by(user_id=user_id, used=False)
        .update({'used': True, 'used_at': now})
    )
    db.session.flush()


@app.route('/api/auth/forgot-password', methods=['POST'])
def initiate_password_reset():
    """
    Initiate a password reset request.

    Expects JSON body: { "email": "user@example.com" }

    Security considerations:
    - Always returns the same response regardless of whether the email exists
      (prevents user enumeration).
    - Only the hashed token is stored in the database.
    - The plaintext token is sent via email and never persisted.
    - Any previously active tokens for this user are invalidated on new request.
    - Token expires after a configurable window (default: 30 minutes).
    - Token is single-use and marked as used immediately upon consumption.
    """
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({'error': 'Invalid request body. JSON required.'}), 400

    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({'error': 'Email address is required.'}), 400

    # Generic success response to prevent user enumeration
    generic_response = jsonify({
        'message': (
            'If an account with that email address exists, '
            'you will receive a password reset link shortly.'
        )
    }), 200

    # Look up the user
    user = User.query.filter_by(email=email, is_active=True).first()
    if not user:
        # Return generic success to prevent email enumeration
        return generic_response

    try:
        # Invalidate any existing unused tokens for this user
        invalidate_existing_tokens(user.id)

        # Generate a cryptographically secure token (URL-safe base64)
        # 32 bytes of randomness → 43-character URL-safe base64 string
        plaintext_token = secrets.token_urlsafe(32)

        # Hash the token for storage (SHA-256; no salt needed since token is
        # already a high-entropy random value)
        token_hash = hash_token(plaintext_token)

        # Calculate expiry timestamp
        expiry_minutes = app.config['RESET_TOKEN_EXPIRY_MINUTES']
        expires_at = datetime.now(timezone.ut