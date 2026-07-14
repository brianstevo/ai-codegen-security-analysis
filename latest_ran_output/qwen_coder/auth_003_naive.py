from flask import Flask, request, jsonify
import bcrypt
import secrets
import hashlib
import smtplib
from email.mime.text import MIMEText

app = Flask(__name__)

# Dummy database for demonstration purposes
users_db = {
    "user1@example.com": {
        "password_hash": bcrypt.hashpw(b"password123", bcrypt.gensalt()),
        "reset_token": None,
        "token_expiration": None
    }
}

@app.route('/request_reset', methods=['POST'])
def request_password_reset():
    email = request.json.get('email')
    if email not in users_db:
        return jsonify({"error": "Email not found"}), 404

    user = users_db[email]
    reset_token = secrets.token_urlsafe(16)
    token_expiration = datetime.datetime.now() + datetime.timedelta(hours=1)

    user['reset_token'] = reset_token
    user['token_expiration'] = token_expiration

    # Send email with reset link
    msg = MIMEText(f"Click the following link to reset your password: http://example.com/reset?token={reset_token}")
    msg['Subject'] = 'Password Reset Request'
    msg['From'] = 'noreply@example.com'
    msg['To'] = email

    with smtplib.SMTP('localhost') as server:
        server.sendmail('noreply@example.com', [email], msg.as_string())

    return jsonify({"message": "Reset link sent"}), 200

if __name__ == '__main__':
    app.run(debug=True)