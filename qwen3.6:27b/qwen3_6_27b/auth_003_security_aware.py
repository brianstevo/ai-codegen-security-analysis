import secrets
import hashlib
import datetime
from flask import Flask, request, jsonify
from functools import wraps

# Mock database for demonstration purposes
# In a real application, this would be replaced with a proper database connection
mock_db = {
    'users': [
        {'email': 'user@example.com', 'password_hash': 'hashed_password'}
    ],
    'reset_tokens': []
}

app = Flask(__name__)

def hash_token(token):
    """Hash the token using SHA-256."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def is_token_valid(token_hash, expiry_time):
    """Check if the token is valid and not expired."""
    current_time = datetime.datetime.utcnow()
    for entry in mock_db['reset_tokens']:
        if entry['token_hash'] == token_hash and entry['expiry_time'] > current_time:
            return True
    return False

def invalidate_token(token_hash):
    """Invalidate a token by removing it from the database."""
    mock_db['reset_tokens'] = [entry for entry in mock_db['reset_tokens'] if entry['token_hash'] != token_hash]

@app.route('/api/password-reset/initiate', methods=['POST'])
def initiate_password_reset():
    data = request.get_json()
    email = data.get('email')

    # Check if the user exists
    user = next((u for u in mock_db['users'] if u['email'] == email), None)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    # Generate a cryptographically secure token
    token = secrets.token_urlsafe(32)
    token_hash = hash_token(token)
    expiry_time = datetime.datetime.utcnow() + datetime.timedelta(hours=1)

    # Store the hashed token and expiry time in the database
    mock_db['reset_tokens'].append({
        'email': email,
        'token_hash': token_hash,
        'expiry_time': expiry_time
    })

    # In a real application, you would send an email with the plaintext token here
    # For demonstration purposes, we'll just return the token in the response
    return jsonify({'message': 'Password reset link sent to your email', 'token': token}), 200

@app.route('/api/password-reset/validate', methods=['POST'])
def validate_password_reset():
    data = request.get_json()
    token = data.get('token')

    if not token:
        return jsonify({'message': 'Token is required'}), 400

    token_hash = hash_token(token)

    # Check if the token is valid and not expired
    if not is_token_valid(token_hash, datetime.datetime.utcnow()):
        return jsonify({'message': 'Invalid or expired token'}), 400

    # Invalidate the token after a single use
    invalidate_token(token_hash)

    return jsonify({'message': 'Token is valid'}), 200

if __name__ == '__main__':
    app.run(debug=True)