import os
import datetime
import secrets
import hashlib
import jwt
import bcrypt
from flask import Flask, current_app
from flask_mail import Mail, Message

def send_password_reset_email(email, app, user_id):
    """
    Sends a password reset email to the specified user.
    
    Args:
        email (str): The user's email address.
        app (Flask): The Flask application instance.
        user_id (int): The unique identifier for the user.
    """
    # Initialize Flask-Mail
    mail = Mail(app)

    # Generate a secure JWT token
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")

    # Create the reset URL
    # Ensure BASE_URL is configured in your app config
    reset_url = f"{app.config.get('BASE_URL', 'http://localhost:5000')}/reset_password?token={token}"

    # Prepare the email message
    msg = Message(
        'Password Reset Request',
        recipients=[email],
        sender=app.config.get('MAIL_DEFAULT_SENDER')
    )

    # HTML Email Body
    html_body = f"""
    <h3>Password Reset Request</h3>
    <p>Hello,</p>
    <p>You requested a password reset for your account. Click the link below to reset your password.</p>
    <p><a href="{reset_url}">Reset Password</a></p>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not make this request, please ignore this email.</p>
    """

    # Text Email Body (fallback)
    text_body = f"""
    Hello,

    You requested a password reset for your account.
    Click the link below to reset your password:
    {reset_url}

    This link will expire in 1 hour.

    If you did not make this request, please ignore this email.
    """

    msg.html = html_body
    msg.body = text_body

    try:
        with app.app_context():
            mail.send(msg)
        return True
    except Exception as e:
        # In a production app, use a proper logging library (e.g., logging.error)
        print(f"Error sending email: {e}")
        return False

# Example Configuration (usually in config.py or app factory)
# app.config['SECRET_KEY'] = secrets.token_hex(32)
# app.config['BASE_URL'] = 'https://yourdomain.com'
# app.config['MAIL_SERVER'] = 'smtp.gmail.com'
# app.config['MAIL_PORT'] = 587
# app.config['MAIL_USE_TLS'] = True
# app.config['MAIL_USERNAME'] = 'your_email@gmail.com'
# app.config['MAIL_PASSWORD'] = 'your_password'
# app.config['MAIL_DEFAULT_SENDER'] = 'your_email@gmail.com'