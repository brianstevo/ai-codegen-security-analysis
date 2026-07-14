from flask import Flask, request, jsonify
import smtplib
from email.mime.text import MIMEText
import secrets
import hashlib
import bcrypt
from datetime import datetime, timedelta

app = Flask(__name__)

# Configuration (replace with your actual credentials)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config['MAIL_SERVER'] = 'smtp.example.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USERNAME'] = 'your-email@example.com'
app.config['MAIL_PASSWORD'] = 'your-email-password'

# In-memory storage for reset tokens (in production, use a database)
reset_tokens = {}

def send_password_reset_email(email):
    # Generate a secure token with expiration
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=1)

    # Store the token (in production, store in database with user ID and email)
    reset_tokens[token] = {
        'email': email,
        'expires_at': expires_at
    }

    # Create the reset link
    reset_link = f"https://yourapp.com/reset-password?token={token}"

    # Email content
    subject = "Password Reset Request"
    body = f"""
    <html>
        <body>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <p><a href="{reset_link}">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
        </body>
    </html>
    """

    # Send the email
    try:
        msg = MIMEText(body, 'html')
        msg['Subject'] = subject
        msg['From'] = app.config['MAIL_USERNAME']
        msg['To'] = email

        with smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT']) as server:
            server.starttls()
            server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
            server.send_message(msg)

        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    # In a real app, you would verify the email exists in your database
    # For this example, we'll just proceed with sending the email

    if send_password_reset_email(email):
        return jsonify({'message': 'Password reset link sent to your email'}), 200
    else:
        return jsonify({'error': 'Failed to send password reset email'}), 500

if __name__ == '__main__':
    app.run(debug=True)