```python
import os
import secrets
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
import bcrypt

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///users.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Flask-Mail Configuration
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'False').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', 'your-email@gmail.com')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', 'your-email-password')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@yourapp.com')

# Frontend URL for password reset
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
RESET_TOKEN_EXPIRY_HOURS = 1

db = SQLAlchemy(app)
mail = Mail(app)


# Models
class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    username = db.Column(db.String(100), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<User {self.email}>'


class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token_hash = db.Column(db.String(255), nullable=False, unique=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('reset_tokens', lazy=True))

    def is_expired(self):
        return datetime.utcnow() > self.expires_at

    def is_valid(self):
        return not self.is_used and not self.is_expired()

    def __repr__(self):
        return f'<PasswordResetToken user_id={self.user_id}>'


def generate_reset_token():
    """Generate a secure random token."""
    return secrets.token_urlsafe(64)


def hash_token(token: str) -> str:
    """Hash the token using SHA-256 before storing in DB."""
    return hashlib.sha256(token.encode()).hexdigest()


def send_reset_email(user: User, reset_token: str) -> bool:
    """Send a password reset email to the user."""
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Password Reset</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 8px;
                padding: 40px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
            }}
            .header h1 {{
                color: #333333;
                font-size: 24px;
            }}
            .content {{
                color: #555555;
                font-size: 16px;
                line-height: 1.6;
            }}
            .btn {{
                display: inline-block;
                padding: 12px 30px;
                background-color: #4CAF50;
                color: #ffffff;
                text-decoration: none;
                border-radius: 5px;
                font-size: 16px;
                margin: 20px 0;
            }}
            .footer {{
                margin-top: 30px;
                font-size: 12px;
                color: #999999;
                text-align: center;
            }}
            .warning {{
                background-color: #fff3cd;
                border: 1px solid #ffc107;
                border-radius: 4px;
                padding: 10px;
                margin-top: 20px;
                font-size: 14px;
                color: #856404;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset Request</h1>
            </div>
            <div class="content">
                <p>Hello <strong>{user.username}</strong>,</p>
                <p>We received a request to reset the password for your account associated with this email address.</p>
                <p>Click the button below to reset your password:</p>
                <p style="text-align: center;">
                    <a href="{reset_link}" class="btn">Reset My Password</a>
                </p>
                <p>Or copy and paste the following link into your browser:</p>
                <p style="word-break: break-all; color: #4CAF50;">{reset_link}</p>
                <div class="warning">
                    <strong>⚠ Important:</strong> This link will expire in <strong>{RESET_TOKEN_EXPIRY_HOURS} hour(s)</strong>.
                    If you did not request a password reset, please ignore this email or contact support if you have concerns.
                </div>
            </div>
            <div class="footer">
                <p>This is an automated email, please do not reply.</p>
                <p>&copy; {datetime.utcnow().year} YourApp. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_body = f"""
    Hello {user.username},

    We received a request to reset the password for your account.

    Please click the following link to reset your password:
    {reset_link}

    This link will expire in {RESET_TOKEN_EXPIRY_HOURS} hour(s).

    If you did not request a password reset, please ignore this email.

    This is an automated email, please do not reply.
    """

    try:
        msg = Message(
            subject="Password Reset Request",
            recipients=[user.email],
            body=text_body,
            html=html_body
        )
        mail.send(msg)
        return True
    except Exception as e:
        app.logger.error(f"Failed to send password reset email to {user.email}: {str(e)}")
        return False


def