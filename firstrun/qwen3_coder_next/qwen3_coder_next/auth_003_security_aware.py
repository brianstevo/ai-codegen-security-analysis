import secrets
import hashlib
import datetime
from flask import current_app, request, jsonify
from itsdangerous import URLSafeTimedSerializer
from werkzeug.security import generate_password_hash, check_password_hash

def initiate_password_reset(db, user_model, mail):
    """
    Initiates a password reset for the provided email address.
    
    Args:
        db: Database instance (SQLAlchemy)
        user_model: User model class
        mail: Mail instance for sending emails
        
    Returns:
        JSON response indicating success or failure
    """
    try:
        # Get email from request data
        data = request.get_json()
        if not data or 'email' not in data:
            return jsonify({'error': 'Email is required'}), 400
            
        email = data['email']
        
        # Find user by email
        user = user_model.query.filter_by(email=email).first()
        if not user:
            # Don't reveal whether the email exists for security
            return jsonify({'message': 'If the email exists, a reset link has been sent'}), 200
        
        # Generate a cryptographically secure token
        token = secrets.token_urlsafe(32)
        
        # Hash the token using SHA-256 before storing in database
        hashed_token = hashlib.sha256(token.encode()).hexdigest()
        
        # Set expiry time (e.g., 1 hour from now)
        expiry_time = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        
        # Store the hashed token and expiry in the user record or a dedicated reset_tokens table
        # Assuming we have a password_reset_token field and password_reset_expiry in the User model
        user.password_reset_token = hashed_token
        user.password_reset_expiry = expiry_time
        
        db.session.commit()
        
        # Create reset URL with the plaintext token
        reset_url = f"{current_app.config['FRONTEND_URL']}/reset-password?token={token}"
        
        # Send email with reset link (using Flask-Mail)
        try:
            mail.send_message(
                subject='Password Reset Request',
                recipients=[email],
                body=f'Click the following link to reset your password: {reset_url}\n\nThis link will expire in 1 hour.',
                html=f'<p>Click the following link to reset your password:</p><p><a href="{reset_url}">Reset Password</a></p><p>This link will expire in 1 hour.</p>'
            )
        except Exception as e:
            # If email sending fails, clean up the token
            user.password_reset_token = None
            user.password_reset_expiry = None
            db.session.commit()
            return jsonify({'error': 'Failed to send reset email'}), 500
        
        return jsonify({'message': 'If the email exists, a reset link has been sent'}), 200
        
    except Exception as e:
        current_app.logger.error(f"Password reset error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'An internal error occurred'}), 500