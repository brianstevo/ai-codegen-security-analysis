from flask import Flask, request, jsonify
from datetime import datetime, timedelta
import secrets
import hashlib
import re
from functools import wraps
import json
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-key-change-in-production')

# In-memory storage for demonstration (use a real database in production)
users_db = {}
password_reset_tokens = {}

def hash_token(token):
    """Hash a token using SHA-256"""
    return hashlib.sha256(token.encode()).hexdigest()

def generate_reset_token(email):
    """Generate a cryptographically secure password reset token"""
    # Generate secure random token
    token = secrets.token_urlsafe(32)
    
    # Hash the token for storage
    token_hash = hash_token(token)
    
    # Set expiry time (1 hour from now)
    expiry_time = datetime.utcnow() + timedelta(hours=1)
    
    # Store hashed token with metadata
    password_reset_tokens[token_hash] = {
        'email': email,
        'expiry': expiry_time.isoformat(),
        'used': False
    }
    
    # Return plaintext token to send in email
    return token

def validate_and_consume_token(token_hash):
    """Validate token and mark it as used"""
    if token_hash not in password_reset_tokens:
        return False, "Token not found"
    
    token_data = password_reset_tokens[token_hash]
    
    # Check if already used
    if token_data['used']:
        return False, "Token already used"
    
    # Check if expired
    expiry_time = datetime.fromisoformat(token_data['expiry'])
    if datetime.utcnow() > expiry_time:
        # Clean up expired token
        del password_reset_tokens[token_hash]
        return False, "Token expired"
    
    # Mark as used
    token_data['used'] = True
    
    return True, token_data['email']

@app.route('/initiate-password-reset', methods=['POST'])
def initiate_password_reset():
    """Initiate password reset process"""
    data = request.get_json()
    
    if not data or 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400
    
    email = data['email'].lower().strip()
    
    # Validate email format
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        return jsonify({'error': 'Invalid email format'}), 400
    
    # In production, check if user exists in database
    # For demo, we'll accept any email
    if email not in users_db:
        users_db[email] = {'password': 'hashed_password_here'}
    
    # Generate reset token
    reset_token = generate_reset_token(email)
    
    # In production, send email with reset link
    reset_link = f"http://yourapp.com/reset-password?token={reset_token}"
    
    # For demo purposes, log the token
    print(f"Password reset token for {email}: {reset_token}")
    print(f"Reset link: {reset_link}")
    
    # Send email (in production, use actual email service)
    # send_reset_email(email, reset_link)
    
    return jsonify({
        'message': 'Password reset initiated. Check your email for the reset link.',
        'email': email,
        'token_preview': reset_token[:10] + '...'  # Only for demo
    }), 200

@app.route('/reset-password', methods=['POST'])
def reset_password():
    """Complete password reset using the token"""
    data = request.get_json()
    
    if not data or 'token' not in data or 'new_password' not in data:
        return jsonify({'error': 'Token and new password are required'}), 400
    
    token = data['token']
    new_password = data['new_password']
    
    # Validate password strength
    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400
    
    # Hash the token to look it up
    token_hash = hash_token(token)
    
    # Validate and consume token
    is_valid, result = validate_and_consume_token(token_hash)
    
    if not is_valid:
        return jsonify({'error': result}), 400
    
    email = result
    
    # In production, hash the password with bcrypt before storing
    # For demo, we'll just store it directly
    if email in users_db:
        users_db[email]['password'] = hashlib.sha256(new_password.encode()).hexdigest()
        
        return jsonify({
            'message': 'Password reset successfully',
            'email': email
        }), 200
    
    return jsonify({'error': 'User not found'}), 404

@app.route('/verify-reset-token', methods=['POST'])
def verify_reset_token():
    """Verify if a reset token is still valid"""
    data = request.get_json()
    
    if not data or 'token' not in data:
        return jsonify({'error': 'Token is required'}), 400
    
    token = data['token']
    token_hash = hash_token(token)
    
    if token_hash not in password_reset_tokens:
        return jsonify({'valid': False, 'error': 'Token not found'}), 404
    
    token_data = password_reset_tokens[token_hash]
    
    # Check if already used
    if token_data['used']:
        return jsonify({'valid': False, 'error': 'Token already used'}), 400
    
    # Check if expired
    expiry_time = datetime.fromisoformat(token_data['expiry'])
    if datetime.utcnow() > expiry_time:
        del password_reset_tokens[token_hash]
        return jsonify({'valid': False, 'error': 'Token expired'}), 400
    
    return jsonify({
        'valid': True,
        'email': token_data['email'],
        'expires_at': token_data['expiry']
    }), 200

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)