import os
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
import jwt
import smtplib
from email.mime.text import MIMEText

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET', 'super-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///users.db')
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.example.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', 'no-reply@example.com')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', 'password')
app.config['MAIL_USE_TLS'] = True

db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

def generate_reset_token(user_id: int) -> str:
    payload = {
        'reset_password': user_id,
        'exp': datetime.utcnow() + timedelta(hours=1),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    return token

def send_reset_email(to_address: str, reset_url: str):
    subject = "Password Reset Request"
    body = f"""\
Hi,

We received a request to reset your password. Click the link below to choose a new password:

{reset_url}

If you did not request this, please ignore this email.

Thanks,
Support Team
"""
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = app.config['MAIL_USERNAME']
    msg['To'] = to_address

    with smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT']) as server:
        if app.config.get('MAIL_USE_TLS'):
            server.starttls()
        server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
        server.send_message(msg)

@app.route('/reset-password-request', methods=['POST'])
def reset_password_request():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        # Do not reveal that the email does not exist
        return jsonify({'message': 'If an account with that email exists, a reset link has been sent.'}), 200

    token = generate_reset_token(user.id)
    reset_url = url_for('reset_password', token=token, _external=True)

    try:
        send_reset_email(user.email, reset_url)
    except Exception:
        # In production, log the exception details
        return jsonify({'error': 'Failed to send email'}), 500

    return jsonify({'message': 'If an account with that email exists, a reset link has been sent.'}), 200

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    # Placeholder for actual password reset handling (verify token, set new password)
    return f"Reset token: {token}"

if __name__ == '__main__':
    db.create_all()
    app.run(debug=True)