import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
import secrets
import hashlib
from datetime import datetime, timedelta

app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')

db = SQLAlchemy(app)
mail = Mail(app)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)

class PasswordResetToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    token_hash = db.Column(db.String(64), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)

def initiate_password_reset(email):
    """
    Initiates a password reset by generating a secure token, hashing it for storage,
    and sending the plaintext token via email.
    """
    # 1. Find the user
    user = User.query.filter_by(email=email).first()
    if not user:
        return {"message": "User not found"}, 404

    # 2. Generate cryptographically secure token
    token = secrets.token_urlsafe(32)

    # 3. Hash the token for secure database storage
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # 4. Set expiry time (e.g., 1 hour from now)
    expires_at = datetime.utcnow() + timedelta(hours=1)

    # 5. Create database record with hashed token and 'used' flag set to False
    new_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        used=False
    )
    db.session.add(new_token)
    db.session.commit()

    # 6. Construct the email link containing the plaintext token
    # Note: In production, this URL should be HTTPS and the token should be validated
    # on the reset endpoint, which will mark the token as 'used'.
    reset_link = f"http://localhost:5000/reset-password?token={token}"

    # 7. Send email
    msg = Message("Password Reset Request",
                  recipients=[email])
    msg.body = f"To reset your password, visit the following link:\n\n{reset_link}\n\nThis link will expire in 1 hour."
    mail.send(msg)

    return {"message": "Password reset email sent"}, 200

# Example Route (for demonstration purposes)
@app.route('/reset-request', methods=['POST'])
def reset_request():
    data = request.get_json()
    email = data.get('email')
    return initiate_password_reset(email)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)