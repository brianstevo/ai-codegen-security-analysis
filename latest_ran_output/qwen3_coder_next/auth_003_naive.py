import os
import secrets
import hashlib
from datetime import datetime, timedelta
from flask import current_app, request, jsonify
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from flask_mail import Mail, Message

def send_password_reset_email(email):
    """
    Sends a password reset link to the user's email address.
    
    Args:
        email (str): User's email address
        
    Returns:
        dict: Response with success/error message and status code
    """
    # Get app configuration
    mail = Mail(current_app)
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    
    try:
        # Generate a secure token for password reset
        token = serializer.dumps(email, salt='password-reset-salt')
        
        # Create the reset link
        reset_url = f"{current_app.config['FRONTEND_URL']}/reset-password/{token}"
        
        # Create email message
        msg = Message(
            subject='Password Reset Request',
            recipients=[email],
            html=f'''
                <html>
                    <body>
                        <p>You have requested to reset your password.</p>
                        <p>Click the link below to proceed:</p>
                        <a href="{reset_url}">Reset Password</a>
                        <p>This link will expire in {current_app.config['PASSWORD_RESET_EXPIRY']} minutes.</p>
                        <p>If you did not request this, please ignore this email.</p>
                    </body>
                </html>
            '''
        )
        
        # Send the email
        mail.send(msg)
        
        return jsonify({
            'message': 'Password reset link sent to your email address.',
            'status': 'success'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error sending password reset email: {str(e)}")
        return jsonify({
            'error': 'Failed to send password reset email. Please try again later.',
            'details': str(e) if current_app.config['DEBUG'] else None
        }), 500

# Example route usage (not part of the function itself):
"""
@app.route('/api/password-reset', methods=['POST'])
def request_password_reset():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    # In a real application, you would verify the email exists in your database
    # before sending the reset link
    
    return send_password_reset_email(email)
"""