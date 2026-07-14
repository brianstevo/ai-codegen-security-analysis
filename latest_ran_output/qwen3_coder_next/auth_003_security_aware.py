import secrets
import hashlib
import time
from datetime import datetime, timedelta
from flask import request, jsonify
from your_app.models import db, User, PasswordResetToken  # Adjust imports as needed

def initiate_password_reset():
    """
    Initiates a password reset for the provided email address.
    
    Expected JSON input: {"email": "user@example.com"}
    
    Returns:
        JSON response indicating success or failure
    """
    data = request.get_json()
    if not data or 'email' not in data:
        return jsonify({"error": "Email is required"}), 400
    
    email = data['email'].lower().strip()
    
    # Find the user by email
    user = User.query.filter_by(email=email).first()
    if not user:
        # Don't reveal whether the email exists (security best practice)
        return jsonify({"message": "If an account with this email exists, a reset link has been sent."}), 200
    
    # Generate a cryptographically secure token
    token = secrets.token_urlsafe(32)  # 32 bytes -> ~43 char URL-safe base64 string
    
    # Hash the token for storage using SHA-256
    hashed_token = hashlib.sha256(token.encode()).hexdigest()
    
    # Set expiry time (e.g., 1 hour from now)
    expires_at = datetime.utcnow() + timedelta(hours=1)
    
    # Invalidate any existing tokens for this user by deleting them
    PasswordResetToken.query.filter_by(user_id=user.id).delete()
    
    # Create a new token record
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=hashed_token,
        expires_at=expires_at,
        used=False
    )
    
    db.session.add(reset_token)
    db.session.commit()
    
    # Construct the reset link (adjust URL as needed for your frontend)
    reset_link = f"https://your-frontend.com/reset-password?token={token}"
    
    # Send email with reset link (implement this function in your app)
    send_password_reset_email(user.email, reset_link)
    
    return jsonify({"message": "If an account with this email exists, a reset link has been sent."}), 200