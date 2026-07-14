from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets
import hashlib
from datetime import datetime, timedelta

app = Flask(__name__)
SECRET_KEY = 'your_secret_key'

# Dummy database for demonstration purposes
users_db = {}

@app.route('/request_reset', methods=['POST'])
def request_password_reset():
    email = request.json.get('email')
    if email not in users_db:
        return jsonify({'error': 'User not found'}), 404

    user = users_db[email]
    token = secrets.token_urlsafe()
    hashed_token = hashlib.sha256(token.encode()).hexdigest()
    expiry_time = datetime.utcnow() + timedelta(hours=1)

    # Store the hashed token and its expiry time in the database
    user['reset_token'] = {'token': hashed_token, 'expiry': expiry_time}

    # Send an email with a link containing the plaintext token
    send_reset_email(email, token)

    return jsonify({'message': 'Password reset email sent'}), 200

def send_reset_email(email, token):
    # Dummy function to simulate sending an email
    print(f"Sending password reset email to {email} with token: {token}")

if __name__ == '__main__':
    app.run(debug=True)