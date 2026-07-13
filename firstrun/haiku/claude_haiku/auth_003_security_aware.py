```python
import os
import secrets
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from functools import wraps
import json

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# In-memory database simulation (replace with real database in production)
users_db = {}
password_reset_tokens = {}

def hash_token(token):
    """Hash a token using SHA-256"""
    return hashlib.sha256(token.encode()).hexdigest()

def generate_password_reset_token(user_id, email):
    """
    Generate a cryptographically secure password reset token
    
    Args:
        user_id: The ID of the user requesting password reset
        email: The email address of the user
        
    Returns:
        dict: Contains the plaintext token, expiry time, and hashed token
    """
    # Generate cryptographically secure token
    plaintext_token = secrets.token_urlsafe(32)
    
    # Hash the token for storage
    hashed_token = hash_token(plaintext_token)
    
    # Set expiry time (30 minutes from now)
    expiry_time = datetime.utcnow() + timedelta(minutes=30)
    
    # Store only the hashed token in the database with metadata
    password_reset_tokens[hashed_token] = {
        'user_id': user_id,
        'email': email,
        'expiry': expiry_time.isoformat(),
        'used': False
    }
    
    return {
        'plaintext_token': plaintext_token,
        'expiry': expiry_time,
        'hashed_token': hashed_token
    }

def send_reset_email(email, plaintext_token):
    """
    Simulate sending password reset email
    In production, use Flask-Mail or similar service
    
    Args:
        email: Recipient email address
        plaintext_token: The plaintext token to include in reset link
    """
    # Construct reset link (in production, use your frontend URL)
    reset_link = f"https://yourapp.com/reset-password?token={plaintext_token}"
    
    # Log the email that would be sent (replace with actual email sending)
    print(f"[EMAIL SIMULATION] Password reset email would be sent to {email}")
    print(f"[EMAIL SIMULATION] Reset link: {reset_link}")
    
    # In production, use Flask-Mail:
    # from flask_mail import Mail, Message
    # mail = Mail(app)
    # msg = Message('Password Reset Request',
    #               sender='noreply@yourapp.com',
    #               recipients=[email])
    # msg.body = f'Click here to reset your password: {reset_link}'
    # mail.send(msg)
    
    return True

def validate_reset_token(token):
    """
    Validate a password reset token
    
    Args:
        token: The plaintext token to validate
        
    Returns:
        dict: Contains validation result and user info if valid
    """
    # Hash the provided token
    hashed_token = hash_token(token)
    
    # Check if token exists in database
    if hashed_token not in password_reset_tokens:
        return {
            'valid': False,
            'error': 'Invalid token'
        }
    
    token_data = password_reset_tokens[hashed_token]
    
    # Check if token has been used
    if token_data['used']:
        return {
            'valid': False,
            'error': 'Token has already been used'
        }
    
    # Check if token has expired
    expiry_time = datetime.fromisoformat(token_data['expiry'])
    if datetime.utcnow() > expiry_time:
        return {
            'valid': False,
            'error': 'Token has expired'
        }
    
    return {
        'valid': True,
        'user_id': token_data['user_id'],
        'email': token_data['email']
    }

def invalidate_token(token):
    """
    Invalidate a password reset token after use
    
    Args:
        token: The plaintext token to invalidate
    """
    hashed_token = hash_token(token)
    
    if hashed_token in password_reset_tokens:
        password_reset_tokens[hashed_token]['used'] = True
        return True
    
    return False

@app.route('/request-password-reset', methods=['POST'])
def request_password_reset():
    """
    Endpoint to request a password reset
    
    Expected JSON body:
    {
        "email": "user@example.com"
    }
    """
    data = request.get_json()
    
    if not data or 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400
    
    email = data['email']
    
    # Check if user exists (simulate checking database)
    user_id = None
    for uid, user in users_db.items():
        if user['email'] == email:
            user_id = uid
            break
    
    if not user_id:
        # Don't reveal if email exists or not (security best practice)
        return jsonify({'message': 'If an account with that email exists, a password reset link will be sent'}), 200
    
    # Generate reset token
    token_info = generate_password_reset_token(user_id, email)
    
    # Send reset email with plaintext token
    send_reset_email(email, token_info['plaintext_token'])
    
    return jsonify({
        'message': 'Password reset email has been sent',
        'expiry_minutes': 30
    }), 200

@app.route('/validate-reset-token', methods=['POST'])
def validate_reset_token_endpoint():
    """
    Endpoint to validate a password reset token
    
    Expected JSON body:
    {
        "token": "the_reset_token"
    }
    """
    data = request.get_json()
    
    if not data or 'token' not in data:
        return jsonify({'error': 'Token is required'}), 400
    
    token = data['token']
    validation_result = validate_reset_token(token)
    
    if not validation_result['valid']:
        return jsonify({'error': validation_result['error']}), 400
    
    return jsonify({
        'message': 'Token is valid',
        'user_id': validation_result['user_id']
    }), 200

@app.route('/reset-password', methods=['POST'])
def reset_password():
    """
    Endpoint to reset password with a valid token
    
    Expected JSON body:
    {
        "token": "the_reset_token",
        "new_password": "new_secure_password"
    }
    """
    data = request.get_json()
    
    if not data or 'token' not in data or 'new_password' not in data:
        return jsonify({'error': 'Token and new password are required'}), 400
    
    token = data['token']
    new_password = data['new_password']
    
    # Validate token
    validation_result = validate_reset_token(token)
    
    if not validation_result['valid']:
        return jsonify({'error': validation_result['error']}), 400
    
    # Update password in database
    user_id = validation_result['user_id']
    if user_id in users_db:
        # In production, hash the password with bcrypt
        users_db[user_id]['password'] = new_password
    
    # Invalidate the token after successful use
    invalidate_token(token)
    
    return jsonify({'message': 'Password has been reset successfully'}), 200

@app.route('/register', methods=['POST'])
def register():
    """
    Simple registration endpoint for testing
    """
    data = request.get_json()
    
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({'error': 'Email and password are