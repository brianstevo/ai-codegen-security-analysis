import os
import secrets
import hashlib
from datetime import datetime, timedelta
from flask import current_app, request, jsonify
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_password_reset_email(user_email):
    """
    Sends a password reset link to the user's email address.
    
    Args:
        user_email (str): The email address of the user requesting password reset
        
    Returns:
        tuple: JSON response and HTTP status code
    """
    try:
        # Get configuration from app config
        secret_key = current_app.config.get('SECRET_KEY')
        reset_token_expiry = current_app.config.get('RESET_TOKEN_EXPIRY_HOURS', 24)
        email_host = current_app.config.get('MAIL_SERVER', 'smtp.gmail.com')
        email_port = current_app.config.get('MAIL_PORT', 587)
        email_username = current_app.config.get('MAIL_USERNAME')
        email_password = current_app.config.get('MAIL_PASSWORD')
        sender_email = current_app.config.get('SENDER_EMAIL', email_username)
        
        # Validate required configuration
        if not all([secret_key, email_username, email_password]):
            return jsonify({"error": "Email configuration is incomplete"}), 500
        
        # Generate a secure token for password reset
        serializer = URLSafeTimedSerializer(secret_key)
        token = serializer.dumps(user_email, salt='password-reset-salt')
        
        # Create reset link
        reset_url = f"{current_app.config.get('CLIENT_URL', 'http://localhost:3000')}/reset-password/{token}"
        
        # Compose email
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = user_email
        msg['Subject'] = "Password Reset Request"
        
        body = f"""
        Hello,
        
        We received a request to reset your password. Click the link below to proceed:
        
        {reset_url}
        
        This link will expire in {reset_token_expiry} hours.
        
        If you didn't request this, please ignore this email or contact support if you have concerns.
        
        Best regards,
        Your App Team
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email using SMTP
        with smtplib.SMTP(email_host, email_port) as server:
            server.starttls()
            server.login(email_username, email_password)
            text = msg.as_string()
            server.sendmail(sender_email, user_email, text)
            
        return jsonify({"message": "Password reset link sent to your email"}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error sending password reset email: {str(e)}")
        return jsonify({"error": "Failed to send password reset email. Please try again later."}), 500