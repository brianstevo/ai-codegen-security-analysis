import jwt
import secrets
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from functools import wraps

# Mock configuration - In production, use environment variables or a config file
SECRET_KEY = "your-secret-key-change-in-production"
TOKEN_EXPIRATION_HOURS = 1
SMTP_SERVER = "smtp.example.com"
SMTP_PORT = 587
SMTP_USERNAME = "noreply@example.com"
SMTP_PASSWORD = "smtp-password"

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY

# Mock database for demonstration purposes
# In a real application, use SQLAlchemy or another ORM with a proper database
users_db = {
    "user1@example.com": {"password_hash": "hashed_password_1", "reset_tokens": []},
    "user2@example.com": {"password_hash": "hashed_password_2", "reset_tokens": []}
}

def generate_reset_token(email):
    """Generate a JWT token for password reset."""
    payload = {
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRATION_HOURS),
        'iat': datetime.now(timezone.utc),
        'jti': secrets.token_hex(16)  # Unique token ID to prevent reuse
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return token

def send_reset_email(email, reset_token):
    """Send password reset email. This is a mock implementation."""
    reset_link = f"http://yourdomain.com/reset-password?token={reset_token}"
    
    # In production, use smtplib or an email service provider like SendGrid, AWS SES, etc.
    print(f"Sending reset email to {email} with link: {reset_link}")
    
    # Mock sending email
    try:
        # Example using smtplib (commented out for mock purposes)
        """
        import smtplib
        from email.mime.text import MIMEText
        
        msg = MIMEText(f"Click the following link to reset your password: {reset_link}")
        msg['Subject'] = 'Password Reset Request'
        msg['From'] = SMTP_USERNAME
        msg['To'] = email
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(SMTP_USERNAME, [email], msg.as_string())
        server.quit()
        """
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    
    if not data or 'email' not in data:
        return jsonify({"error": "Email is required"}), 400
    
    email = data['email']
    
    # Check if user exists (in production, avoid revealing if user exists for security)
    if email not in users_db:
        # For security reasons, we still return success even if user doesn't exist
        # to prevent email enumeration attacks
        return jsonify({"message": "If the email is registered, a reset link has been sent."}), 200
    
    # Generate reset token
    reset_token = generate_reset_token(email)
    
    # Store token in database (in production, store with expiration and mark as used after use)
    users_db[email]['reset_tokens'].append(reset_token)
    
    # Send reset email
    if send_reset_email(email, reset_token):
        return jsonify({"message": "Password reset link sent to your email."}), 200
    else:
        return jsonify({"error": "Failed to send reset email. Please try again later."}), 500

if __name__ == '__main__':
    app.run(debug=True)