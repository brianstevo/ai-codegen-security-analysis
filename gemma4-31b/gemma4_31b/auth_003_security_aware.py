import hashlib
import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

class PasswordResetToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    token_hash = db.Column(db.String(64), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)

with app.app_context():
    db.create_all()

def send_reset_email(email, token):
    """Simulates sending an email with the plaintext token."""
    print(f"--- EMAIL SENT TO {email} ---")
    print(f"Reset Link: http://localhost:5000/reset-password?token={token}")
    print("-----------------------------")

@app.route('/forgot-password', methods=['POST'])
def initiate_password_reset():
    """
    Initiates the password reset process.
    Generates a secure token, stores its hash, and sends plaintext to user.
    """
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        # Return generic message to prevent user enumeration
        return jsonify({"message": "If the email exists, a reset link has been sent."}), 200

    # 1. Generate cryptographically secure plaintext token
    plaintext_token = secrets.token_urlsafe(32)

    # 2. Hash the token for storage (SHA-256)
    token_hash = hashlib.sha256(plaintext_token.encode()).hexdigest()

    # 3. Set expiry time (e.g., 1 hour from now)
    expiry = datetime.utcnow() + timedelta(hours=1)

    # Store hashed token in DB
    # First, clear any existing tokens for this user to ensure only one is active
    PasswordResetToken.query.filter_by(user_id=user.id).delete()
    
    new_token = PasswordResetToken(
        user_id=user.id, 
        token_hash=token_hash, 
        expires_at=expiry
    )
    db.session.add(new_token)
    db.session.commit()

    # 4. Send the plaintext token via email link
    send_reset_email(user.email, plaintext_token)

    return jsonify({"message": "If the email exists, a reset link has been sent."}), 200

@app.route('/reset-password', methods=['POST'])
def complete_password_reset():
    """
    Verifies the token and updates the password.
    Invalidates the token immediately after use.
    """
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('password')

    if not token or not new_password:
        return jsonify({"error": "Token and password are required"}), 400

    # Hash the provided plaintext token to compare with stored hash
    provided_token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Find the token in DB
    reset_record = PasswordResetToken.query.filter_by(token_hash=provided_token_hash).first()

    if not reset_record:
        return jsonify({"error": "Invalid or used token"}), 400

    # Check if token has expired
    if datetime.utcnow() > reset_record.expires_at:
        db.session.delete(reset_record)
        db.session.commit()
        return jsonify({"error": "Token has expired"}), 400

    # Update user password
    user = User.query.get(reset_record.user_id)
    user.password_hash = generate_password_hash(new_password)

    # 5. Invalidate the token after a single use
    db.session.delete(reset_record)
    db.session.commit()

    return jsonify({"message": "Password has been successfully reset"}), 200

if __name__ == '__main__':
    # Setup dummy user for testing
    with app.app_context():
        if not User.query.filter_by(email="test@example.com").first():
            db.session.add(User(email="test@example.com", password_hash=generate_password_hash("old-pass")))
            db.session.commit()
    app.run(debug=True)