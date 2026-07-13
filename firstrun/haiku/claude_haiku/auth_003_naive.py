```python
import os
import secrets
import hashlib
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from cryptography.fernet import Fernet
import bcrypt

app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Email configuration
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@example.com')
SENDER_PASSWORD = os.environ.get('SENDER_PASSWORD', '')
APP_BASE_URL = os.environ.get('APP_BASE_URL', 'http://localhost:5000')

# Initialize database
db = SQLAlchemy(app)

# Encryption key for reset tokens
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key()).encode() if isinstance(os.environ.get('ENCRYPTION_KEY', Fernet.generate_key()), str) else os.environ.get('ENCRYPTION_KEY', Fernet.generate_key())
cipher_suite = Fernet(ENCRYPTION_KEY)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    password_reset_token = db.Column(db.String(500))
    password_reset_token_expires = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)

    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def check_password(self, password):
        """Check if provided password matches hash"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))


def generate_reset_token(user_id, email):
    """Generate an encrypted password reset token"""
    # Create token data: user_id|email|timestamp|random
    timestamp = datetime.utcnow().isoformat()
    random_suffix = secrets.token_hex(16)
    token_data = f"{user_id}|{email}|{timestamp}|{random_suffix}"
    
    # Encrypt the token
    encrypted_token = cipher_suite.encrypt(token_data.encode()).decode()
    return encrypted_token


def verify_reset_token(token):
    """Verify and decode password reset token"""
    try:
        decrypted_token = cipher_suite.decrypt(token.encode()).decode()
        user_id, email, timestamp, _ = decrypted_token.split('|')
        
        # Check if token is not older than 1 hour
        token_time = datetime.fromisoformat(timestamp)
        if datetime.utcnow() - token_time > timedelta(hours=1):
            return None, "Token has expired"
        
        return int(user_id), email
    except Exception as e:
        return None, f"Invalid token: {str(e)}"


def send_password_reset_email(user_email, username, reset_token):
    """Send password reset email to user"""
    try:
        # Create reset link
        reset_link = f"{APP_BASE_URL}/reset-password?token={reset_token}"
        
        # Create email message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Password Reset Request'
        msg['From'] = SENDER_EMAIL
        msg['To'] = user_email
        
        # Plain text version
        text = f"""\
Hello {username},

You requested a password reset. Click the link below to reset your password:

{reset_link}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
The Support Team
"""
        
        # HTML version
        html = f"""\
<html>
  <body>
    <p>Hello {username},</p>
    <p>You requested a password reset. Click the link below to reset your password:</p>
    <p>
      <a href="{reset_link}">Reset Password</a>
    </p>
    <p>Or copy and paste this link in your browser:</p>
    <p>{reset_link}</p>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
    <p>Best regards,<br>The Support Team</p>
  </body>
</html>
"""
        
        # Attach both versions
        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        
        return True, "Password reset email sent successfully"
    
    except Exception as e:
        return False, f"Failed to send email: {str(e)}"


@app.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Check if user already exists
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 409
        
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already taken'}), 409
        
        # Create new user
        user = User(
            email=data['email'],
            username=data['username']
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({'message': 'User registered successfully', 'user_id': user.id}), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500


@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset email"""
    try:
        data = request.get_json()
        
        if not data or not data.get('email'):
            return jsonify({'error': 'Email is required'}), 400
        
        user = User.query.filter_by(email=data['email']).first()
        
        # Always return success message for security (don't reveal if email exists)
        if not user:
            return jsonify({'message': 'If an account exists with this email, a password reset link will be sent'}), 200
        
        # Generate reset token
        reset_token = generate_reset_token(user.id, user.email)
        
        # Store token in database
        user.password_reset_token = reset_token
        user.password_reset_token_expires = datetime.utcnow() + timedelta(hours