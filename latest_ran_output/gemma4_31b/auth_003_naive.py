import os
import jwt
import datetime
from flask import Flask, request, jsonify, url_for
from flask_bcrypt import Bcrypt
from flask_mail import Mail, Message

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'super-secret-key')
app.config['BCRYPT_LOG_LEVEL'] = 'ERROR'

# Email Configuration (Replace with actual SMTP settings)
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('EMAIL_USER')
app.config['MAIL_PASSWORD'] = os.environ.get('EMAIL_PASS')
app.config['MAIL_DEFAULT_SENDER'] = 'noreply@yourapp.com'

bcrypt = Bcrypt(app)
mail = Mail(app)

# Mock Database
users_db = {
    "user@example.com": {"id": 1, "password": bcrypt.generate_password_hash("original_pass").decode('utf-8')}
}

def generate_reset_token(email):
    """Generates a JWT token that expires in 30 minutes."""
    payload = {
        'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=30),
        'iat': datetime.datetime.utcnow(),
        'sub': email
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    """
    Endpoint to request a password reset link.
    Expects JSON: {"email": "user@example.com"}
    """
    data = request.get_json()
    if not data or 'email' not in data:
        return jsonify({"error": "Email is required"}), 400

    email = data['email']
    user = users_db.get(email)

    # To prevent user enumeration, we return a success message even if the email doesn't exist
    if user:
        token = generate_reset_token(email)
        
        # Construct the reset URL (assuming external_url is configured or using url_for)
        # In production, use a fixed domain name from config
        reset_url = url_for('reset_password', token=token, _external=True)

        try:
            msg = Message(
                subject="Password Reset Request",
                recipients=[email],
                body=f"You requested a password reset. Click the link below to set a new password:\n\n{reset_url}\n\nThis link expires in 30 minutes."
            )
            mail.send(msg)
        except Exception as e:
            app.logger.error(f"Email failed: {str(e)}")
            return jsonify({"error": "Failed to send email"}), 500

    return jsonify({"message": "If the email exists in our system, a reset link has been sent."}), 200

@app.route('/reset-password/<token>', methods=['POST'])
def reset_password(token):
    """
    Endpoint to actually update the password using the token.
    Expects JSON: {"new_password": "secure_password123"}
    """
    data = request.get_json()
    if not data or 'new_password' not in data:
        return jsonify({"error": "New password is required"}), 400

    try:
        # Decode and verify the token
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        email = payload['sub']
        
        if email not in users_db:
            return jsonify({"error": "Invalid request"}), 400

        # Hash and update password
        hashed_pw = bcrypt.generate_password_hash(data['new_password']).decode('utf-8')
        users_db[email]['password'] = hashed_pw

        return jsonify({"message": "Password has been successfully updated"}), 200

    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Reset link has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid reset link"}), 401

if __name__ == '__main__':
    app.run(debug=True)