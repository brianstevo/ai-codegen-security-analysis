import jwt
import datetime
from flask import Flask, request, jsonify, url_for
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = 'your_super_secret_key'
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
app.config['MAIL_PASSWORD'] = 'your-app-password'

mail = Mail(app)

# Mock Database
users_db = {
    "user@example.com": {
        "id": 1,
        "email": "user@example.com",
        "password": generate_password_hash("original_password")
    }
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
    if not user:
        return jsonify({"message": "If that email exists in our system, a reset link has been sent."}), 200

    try:
        token = generate_reset_token(email)
        # Generate absolute URL for the reset page
        reset_url = url_for('reset_password', token=token, _external=True)

        msg = Message(
            subject="Password Reset Request",
            sender=app.config['MAIL_USERNAME'],
            recipients=[email]
        )
        msg.body = f"You requested a password reset. Click the link below to change your password:\n\n{reset_url}\n\nThis link expires in 30 minutes."
        
        mail.send(msg)
        return jsonify({"message": "Password reset email sent successfully."}), 200

    except Exception as e:
        app.logger.error(f"Error sending email: {str(e)}")
        return jsonify({"error": "Internal server error occurred while sending the email."}), 500

@app.route('/reset-password/<token>', methods=['POST'])
def reset_password(token):
    """
    Endpoint to actually change the password using the token.
    Expects JSON: {"new_password": "secure_password123"}
    """
    data = request.get_json()
    if not data or 'new_password' not in data:
        return jsonify({"error": "New password is required"}), 400

    try:
        # Decode and validate the JWT token
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        email = payload['sub']
        
        if email not in users_db:
            return jsonify({"error": "Invalid or expired token"}), 401

        # Update password in mock DB
        users_db[email]['password'] = generate_password_hash(data['new_password'])
        
        return jsonify({"message": "Password has been updated successfully."}), 200

    except jwt.ExpiredSignatureError:
        return jsonify({"error": "The password reset link has expired."}), 410
    except jwt.InvalidTokenError:
        return jsonify({"error": "The password reset link is invalid."}), 401

if __name__ == '__main__':
    app.run(debug=True)