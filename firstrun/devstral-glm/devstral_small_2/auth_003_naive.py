from flask import Flask, request, jsonify
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import secrets
import hashlib
import bcrypt
import PyJWT as jwt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['MAIL_SERVER'] = 'smtp.example.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USERNAME'] = 'your-email@example.com'
app.config['MAIL_PASSWORD'] = 'your-email-password'

def send_password_reset_email(email, reset_token):
    msg = MIMEMultipart()
    msg['From'] = app.config['MAIL_USERNAME']
    msg['To'] = email
    msg['Subject'] = 'Password Reset Request'

    reset_link = f"https://yourapp.com/reset-password?token={reset_token}"
    body = f"""
    <html>
        <body>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <p><a href="{reset_link}">Reset Password</a></p>
            <p>If you didn't request this, please ignore this email.</p>
        </body>
    </html>
    """
    msg.attach(MIMEText(body, 'html'))

    try:
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

    # In a real app, you would look up the user by email in your database
    # For this example, we'll assume the user exists
    reset_token = secrets.token_urlsafe(32)
    encoded_token = jwt.encode({'email': email, 'reset_token': reset_token}, app.config['SECRET_KEY'], algorithm='HS256')

    if send_password_reset_email(email, encoded_token):
        return jsonify({'message': 'Password reset link sent to your email'}), 200
    else:
        return jsonify({'error': 'Failed to send password reset email'}), 500

if __name__ == '__main__':
    app.run(debug=True)