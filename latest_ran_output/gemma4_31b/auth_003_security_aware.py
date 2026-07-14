import secrets
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
app.config['SECRET_KEY'] = secrets.token_hex(32)
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    # Store only the hashed version of the reset token
    reset_token_hash = db.Column(db.String(64), nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)

with app.app_context():
    db.create_all()

def send_reset_email(email, token):
    """Simulates sending an email with the plaintext token."""
    print(f"Email sent to {email}: Reset your password using this link: /reset-password?token={token}")

@app.route('/forgot-password', methods=['POST'])
def initiate_password_reset():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        # Return generic message to prevent user enumeration
        return jsonify({"message": "If the email exists, a reset link has been sent."}), 200

    # 1. Generate a cryptographically secure plaintext token
    plaintext_token = secrets.token_urlsafe(32)

    # 2. Hash the token using hashlib (SHA-256) for storage
    hashed_token = hashlib.sha256(plaintext_token.encode()).hexdigest()

    # 3. Set expiry time (e.g., 1 hour from now)
    expiry = datetime.utcnow() + timedelta(hours=1)

    # Store hashed token and expiry in DB
    user.reset_token_hash = hashed_token
    user.reset_token_expiry = expiry
    db.session.commit()

    # 4. Send the plaintext token via email link
    send_reset_email(user.email, plaintext_token)

    return jsonify({"message": "If the email exists, a reset link has been sent."}), 200

@app.route('/reset-password', methods=['POST'])
def complete_password_reset():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400

    # Hash the provided plaintext token to compare with stored hash
    provided_token_hash = hashlib.sha256(token.encode()).hexdigest()

    user = User.query.filter_by(reset_token_hash=provided_token_hash).first()

    if not user:
        return jsonify({"error": "Invalid or expired token"}), 400

    # Check if token has expired
    if datetime.utcnow() > user.reset_token_expiry:
        # Invalidate immediately upon discovery of expiry
        user.reset_token_hash = None
        user.reset_token_expiry = None
        db.session.commit()
        return jsonify({"error": "Token has expired"}), 400

    # Update password and invalidate the token (single-use)
    user.password_hash = generate_password_hash(new_password)
    user.reset_token_hash = None  # Invalidate after use
    user.reset_token_expiry = None # Invalidate after use
    db.session.commit()

    return jsonify({"message": "Password has been successfully reset"}), 200

if __name__ == '__main__':
    app.run(debug=True)