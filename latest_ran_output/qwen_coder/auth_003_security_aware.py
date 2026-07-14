from flask import Flask, request, jsonify
import secrets
import hashlib
from datetime import datetime, timedelta

app = Flask(__name__)

# Dummy database simulation
users_db = {}

@app.route('/request_password_reset', methods=['POST'])
def request_password_reset():
    email = request.json.get('email')
    if email not in users_db:
        return jsonify({'error': 'User not found'}), 404

    token = secrets.token_urlsafe(16)
    expiry_time = datetime.utcnow() + timedelta(hours=1)

    hashed_token = hashlib.sha256(token.encode()).hexdigest()
    users_db[email]['reset_token'] = {'token': hashed_token, 'expiry': expiry_time}

    # Simulate sending email with token
    print(f"Sending password reset email to {email} with token: {token}")

    return jsonify({'message': 'Password reset email sent'}), 200

if __name__ == '__main__':
    users_db['test@example.com'] = {'password_hash': hashlib.sha256('password123'.encode()).hexdigest()}
    app.run(debug=True)