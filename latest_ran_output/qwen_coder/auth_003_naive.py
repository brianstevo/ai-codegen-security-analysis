from flask import Flask, request, jsonify
import bcrypt
import secrets
import hashlib
import smtplib
from email.mime.text import MIMEText

app = Flask(__name__)

# Mock database for demonstration purposes
users_db = {
    'user1@example.com': {'password_hash': bcrypt.hashpw(b'password123', bcrypt.gensalt()), 'reset_token': None}
}

@app.route('/send_password_reset_link', methods=['POST'])
def send_password_reset_link():
    email = request.json.get('email')
    if email not in users_db:
        return jsonify({'error': 'User not found'}), 404

    # Generate a unique reset token
    reset_token = secrets.token_urlsafe()
    users_db[email]['reset_token'] = reset_token

    # Create the password reset link
    reset_link = f"http://example.com/reset_password?token={reset_token}"

    # Send the email with the reset link
    msg = MIMEText(f"Click the following link to reset your password: {reset_link}")
    msg['Subject'] = 'Password Reset Request'
    msg['From'] = 'noreply@example.com'
    msg['To'] = email

    try:
        server = smtplib.SMTP('smtp.example.com', 587)
        server.starttls()
        server.login('your-email@example.com', 'your-password')
        server.sendmail('noreply@example.com', [email], msg.as_string())
        server.quit()
        return jsonify({'message': 'Password reset link sent'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)