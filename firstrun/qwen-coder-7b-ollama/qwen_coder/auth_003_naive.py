from flask import Flask, request, jsonify
import bcrypt
import secrets
import hashlib
import smtplib
from email.mime.text import MIMEText

app = Flask(__name__)

# Dummy database for demonstration purposes
users_db = {
    'user1@example.com': {'password_hash': bcrypt.hashpw(b'password123', bcrypt.gensalt()), 'reset_token': None}
}

@app.route('/request_reset', methods=['POST'])
def request_password_reset():
    email = request.json.get('email')
    if email not in users_db:
        return jsonify({'error': 'User not found'}), 404

    reset_token = secrets.token_urlsafe()
    users_db[email]['reset_token'] = reset_token
    token_hash = hashlib.sha256(reset_token.encode()).hexdigest()

    # Send email with reset link
    msg = MIMEText(f'Click the following link to reset your password: http://example.com/reset?token={token_hash}')
    msg['Subject'] = 'Password Reset Request'
    msg['From'] = 'noreply@example.com'
    msg['To'] = email

    server = smtplib.SMTP('localhost')
    server.sendmail('noreply@example.com', [email], msg.as_string())
    server.quit()

    return jsonify({'message': 'Reset link sent to your email'}), 200