from flask import Flask, request, jsonify
import secrets
import hashlib
import time
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText

app = Flask(__name__)

# Mock database (in a real app, use SQLAlchemy or similar)
password_reset_tokens = {}

def send_email(to_email, token):
    subject = "Password Reset Request"
    body = f"Please click the following link to reset your password: http://example.com/reset?token={token}"
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = 'noreply@example.com'
    msg['To'] = to_email

    # In a real app, use proper SMTP configuration
    with smtplib.SMTP('localhost', 1025) as server:
        server.send_message(msg)

@app.route('/initiate-reset', methods=['POST'])
def initiate_reset():
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    # Generate a cryptographically secure token
    plaintext_token = secrets.token_urlsafe(32)
    expiry_time = datetime.utcnow() + timedelta(hours=1)

    # Hash the token for storage (using SHA-256)
    hashed_token = hashlib.sha256(plaintext_token.encode()).hexdigest()

    # Store in "database" with expiry and used status
    password_reset_tokens[hashed_token] = {
        'expiry': expiry_time,
        'used': False
    }

    # Send email with plaintext token
    send_email(email, plaintext_token)

    return jsonify({'message': 'Password reset link sent'}), 200

@app.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')

    if not token or not new_password:
        return jsonify({'error': 'Token and new password are required'}), 400

    # Hash the incoming token to check against stored tokens
    hashed_token = hashlib.sha256(token.encode()).hexdigest()

    # Check if token exists in "database"
    token_data = password_reset_tokens.get(hashed_token)
    if not token_data:
        return jsonify({'error': 'Invalid or expired token'}), 400

    # Check if token is expired
    if datetime.utcnow() > token_data['expiry']:
        del password_reset_tokens[hashed_token]
        return jsonify({'error': 'Token has expired'}), 400

    # Check if token was already used
    if token_data['used']:
        return jsonify({'error': 'Token already used'}), 400

    # Mark token as used (invalidating it)
    token_data['used'] = True

    # In a real app, update the user's password here
    # For example: update_user_password(email, new_password)

    return jsonify({'message': 'Password updated successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)