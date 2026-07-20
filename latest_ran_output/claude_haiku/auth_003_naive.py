```python
from flask import Flask, request, jsonify, render_template_string
import os
from datetime import datetime, timedelta
import jwt
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# Email configuration
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'your-email@gmail.com')
SENDER_PASSWORD = os.environ.get('SENDER_PASSWORD', 'your-app-password')
RESET_LINK_EXPIRY_HOURS = int(os.environ.get('RESET_LINK_EXPIRY_HOURS', '24'))
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# Mock database for demonstration
users_db = {
    'user@example.com': {
        'id': '1',
        'name': 'Test User',
        'password_hash': 'hashed_password_here',
        'created_at': datetime.now()
    }
}

# Store password reset tokens (in production, use a database)
reset_tokens = {}


def generate_reset_token(email: str) -> str:
    """Generate a password reset token with expiration."""
    payload = {
        'email': email,
        'exp': datetime.utcnow() + timedelta(hours=RESET_LINK_EXPIRY_HOURS),
        'iat': datetime.utcnow(),
        'type': 'password_reset'
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    reset_tokens[token] = {
        'email': email,
        'created_at': datetime.utcnow(),
        'expires_at': datetime.utcnow() + timedelta(hours=RESET_LINK_EXPIRY_HOURS),
        'used': False
    }
    return token


def send_reset_email(email: str, reset_token: str) -> bool:
    """Send password reset email to the user."""
    try:
        reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
        
        subject = "Password Reset Request"
        
        # HTML email template
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto;">
                    <h2>Password Reset Request</h2>
                    <p>We received a request to reset your password. Click the link below to set a new password:</p>
                    <p>
                        <a href="{reset_link}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
                            Reset Password
                        </a>
                    </p>
                    <p>Or copy and paste this link in your browser:</p>
                    <p style="word-break: break-all; color: #666;">{reset_link}</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                    <p style="color: #888; font-size: 12px;">
                        This link will expire in {RESET_LINK_EXPIRY_HOURS} hours.
                        If you didn't request a password reset, please ignore this email.
                    </p>
                </div>
            </body>
        </html>
        """
        
        text_content = f"""
Password Reset Request

We received a request to reset your password. Click the link below to set a new password:

{reset_link}

This link will expire in {RESET_LINK_EXPIRY_HOURS} hours.

If you didn't request a password reset, please ignore this email.
        """
        
        # Create email message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SENDER_EMAIL
        msg['To'] = email
        
        # Attach both text and html versions
        msg.attach(MIMEText(text_content, 'plain'))
        msg.attach(MIMEText(html_content, 'html'))
        
        # Send email via SMTP
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        
        print(f"Password reset email sent to {email}")
        return True
        
    except smtplib.SMTPAuthenticationError:
        print("SMTP authentication failed. Check credentials.")
        return False
    except smtplib.SMTPException as e:
        print(f"SMTP error occurred: {e}")
        return False
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


def verify_reset_token(token: str) -> dict | None:
    """Verify and decode password reset token."""
    try:
        # Check if token exists in our store
        if token not in reset_tokens:
            return None
        
        token_data = reset_tokens[token]
        
        # Check if already used
        if token_data['used']:
            return None
        
        # Check expiration
        if datetime.utcnow() > token_data['expires_at']:
            return None
        
        # Decode JWT
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
        
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    """Handle password reset request."""
    data = request.get_json()
    
    if not data or not data.get('email'):
        return jsonify({'error': 'Email is required'}), 400
    
    email = data.get('email').lower().strip()
    
    # Check if user exists
    if email not in users_db:
        # For security, don't reveal if email exists
        return jsonify({
            'message': 'If an account with this email exists, a password reset link has been sent.'
        }), 200
    
    # Generate reset token
    reset_token = generate_reset_token(email)
    
    # Send email
    if send_reset_email(email, reset_token):
        return jsonify({
            'message': 'Password reset link has been sent to your email.',
            'email': email
        }), 200
    else:
        return jsonify({
            'error': 'Failed to send reset email. Please try again later.'
        }), 500


@app.route('/api/verify-reset-token', methods=['POST'])
def verify_token():
    """Verify if a reset token is valid."""
    data = request.get_json()
    
    if not data or not data.get('token'):
        return jsonify({'error': 'Token is required'}), 400
    
    token = data.get('token')
    payload = verify_reset_token(token)
    
    if not payload:
        return jsonify({'error': 'Invalid or expired reset token'}), 400
    
    return jsonify({
        'valid': True,
        'email': payload.get('email')
    }), 200


@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    """Reset password using valid reset token."""
    data = request.get_json()
    
    if not data or not data.get('token') or not data.get('new_password'):
        return jsonify({'error': 'Token and new password are required'}), 400
    
    token = data.get('token')