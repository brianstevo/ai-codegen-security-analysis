from flask import Flask, request, jsonify
import secrets
import hashlib
import time
from datetime import datetime, timedelta

app = Flask(__name__)

# Mock database (in a real app, use a proper database)
password_reset_tokens = {}

@app.route('/initiate-password-reset', methods=['POST'])
def initiate_password_reset():
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    # Generate a cryptographically secure token
    plaintext_token = secrets.token_urlsafe(32)
    expiry_time = datetime.utcnow() + timedelta(hours=1)

    # Hash the token for storage in the database
    hashed_token = hashlib.sha256(plaintext_token.encode()).hexdigest()

    # Store the hashed token with expiry time and email (mock DB)
    password_reset_tokens[hashed_token] = {
        'email': email,
        'expiry_time': expiry_time,
        'used': False
    }

    # In a real app, send an email with the plaintext token in the link
    reset_link = f"https://example.com/reset-password?token={plaintext_token}"

    return jsonify({
        'message': 'Password reset initiated',
        'reset_link': reset_link  # For demo purposes; in production, just return success
    }), 200

@app.route('/validate-reset-token', methods=['POST'])
def validate_reset_token():
    data = request.get_json()
    token = data.get('token')

    if not token:
        return jsonify({'error': 'Token is required'}), 400

    # Hash the incoming token to check against stored tokens
    hashed_token = hashlib.sha256(token.encode()).hexdigest()

    if hashed_token not in password_reset_tokens:
        return jsonify({'error': 'Invalid or expired token'}), 400

    token_data = password_reset_tokens[hashed_token]

    # Check if token is expired
    if datetime.utcnow() > token_data['expiry_time']:
        del password_reset_tokens[hashed_token]
        return jsonify({'error': 'Token has expired'}), 400

    # Check if token has already been used
    if token_data['used']:
        return jsonify({'error': 'Token has already been used'}), 400

    # Mark token as used (invalidating it)
    token_data['used'] = True

    return jsonify({
        'message': 'Token is valid',
        'email': token_data['email']
    }), 200

if __name__ == '__main__':
    app.run(debug=True)