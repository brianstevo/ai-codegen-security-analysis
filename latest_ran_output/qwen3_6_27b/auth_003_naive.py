import secrets
import smtplib
from email.mime.text import MIMEText
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration placeholders - replace with actual values in production
SMTP_SERVER = 'smtp.example.com'
SMTP_PORT = 587
SMTP_USERNAME = 'your_email@example.com'
SMTP_PASSWORD = 'your_password'
FROM_EMAIL = 'noreply@example.com'
RESET_URL_BASE = 'https://example.com/reset-password?token='

# In-memory storage for demonstration purposes only. 
# Use a database in production.
user_database = {
    "user@example.com": {"password_hash": "hashed_password_here"}
}

def generate_reset_token():
    """Generate a secure random token."""
    return secrets.token_urlsafe(32)

def send_reset_email(email, token):
    """Send password reset email."""
    reset_link = f"{RESET_URL_BASE}{token}"
    
    msg = MIMEText(f"Click the following link to reset your password: {reset_link}")
    msg['Subject'] = 'Password Reset Request'
    msg['From'] = FROM_EMAIL
    msg['To'] = email
    
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(FROM_EMAIL, [email], msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    # Check if user exists (optional: always return success to prevent enumeration)
    if email not in user_database:
        # For security, we might still generate a token and send an email 
        # that says "If this email is registered..." or just ignore it.
        # Here we simply return success regardless to avoid user enumeration.
        pass
    
    token = generate_reset_token()
    
    # In production, store the token in a database with an expiration time
    # and associate it with the user's ID/email.
    # For this example, we assume the token is valid if sent.
    
    success = send_reset_email(email, token)
    
    if success:
        return jsonify({"message": "Password reset link sent"}), 200
    else:
        return jsonify({"error": "Failed to send email"}), 500

if __name__ == '__main__':
    app.run(debug=True)