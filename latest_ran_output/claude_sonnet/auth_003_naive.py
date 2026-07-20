```python
import os
import secrets
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_mail import Mail, Message
import bcrypt
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, DateTime, Boolean

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///users.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Flask-Mail configuration
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'False').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', 'your-email@gmail.com')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', 'your-email-password')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@yourdomain.com')
app.config['FRONTEND_URL'] = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# Token expiration time in minutes
RESET_TOKEN_EXPIRY_MINUTES = 60

db = SQLAlchemy(app)
mail = Mail(app)


# Models
class User(db.Model):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def set_password(self, password: str) -> None:
        """Hash and set the user's password."""
        salt = bcrypt.gensalt(rounds=12)
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password: str) -> bool:
        """Verify the user's password."""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )

    def __repr__(self):
        return f'<User {self.username}>'


class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    token_hash = Column(String(255), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship('User', backref=db.backref('reset_tokens', lazy=True))

    def is_valid(self) -> bool:
        """Check if the token is still valid (not expired and not used)."""
        return not self.used and datetime.utcnow() < self.expires_at

    def __repr__(self):
        return f'<PasswordResetToken user_id={self.user_id}>'


# Helper functions
def generate_reset_token() -> str:
    """Generate a cryptographically secure random token."""
    return secrets.token_urlsafe(64)


def hash_token(token: str) -> str:
    """Hash a token using SHA-256 for secure storage."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def invalidate_existing_tokens(user_id: int) -> None:
    """Invalidate all existing active reset tokens for a user."""
    PasswordResetToken.query.filter_by(
        user_id=user_id,
        used=False
    ).update({'used': True})
    db.session.commit()


def send_reset_email(user: User, reset_token: str) -> bool:
    """
    Send password reset email to the user.

    Args:
        user: The User object.
        reset_token: The plain-text reset token (not hashed).

    Returns:
        True if email was sent successfully, False otherwise.
    """
    try:
        reset_url = f"{app.config['FRONTEND_URL']}/reset-password?token={reset_token}"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .container {{
                    background-color: #f9f9f9;
                    border-radius: 8px;
                    padding: 30px;
                    border: 1px solid #e0e0e0;
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                }}
                .button {{
                    display: inline-block;
                    padding: 12px 30px;
                    background-color: #007bff;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    margin: 20px 0;
                }}
                .footer {{
                    margin-top: 30px;
                    font-size: 12px;
                    color: #666666;
                    text-align: center;
                }}
                .warning {{
                    background-color: #fff3cd;
                    border: 1px solid #ffc107;
                    border-radius: 4px;
                    padding: 10px;
                    margin-top: 20px;
                    font-size: 13px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Password Reset Request</h2>
                </div>
                <p>Hello <strong>{user.username}</strong>,</p>
                <p>We received a request to reset the password for your account associated with this email address.</p>
                <p>Click the button below to reset your password:</p>
                <div style="text-align: center;">
                    <a href="{reset_url}" class="button">Reset My Password</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #007bff;">{reset_url}</p>
                <div class="warning">
                    <strong>⚠️ Important:</strong>
                    <ul>
                        <li>This link will expire in <strong>{RESET_TOKEN_EXPIRY_MINUTES} minutes</strong>.</li>
                        <li>If you did not request a password reset, please ignore this email.</li>
                        <li>Never share this link with anyone.</li>
                    </ul>
                </div>
                <div class