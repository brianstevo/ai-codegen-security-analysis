from flask import Flask, request, jsonify
import secrets
import hashlib
import datetime

app = Flask(__name__)

# Mock database for demonstration purposes
users_db = {}

def generate_token():
    return secrets.token_urlsafe(16)

def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()

@app.route('/request_reset', methods=['POST'])
def request_password_reset():
    email = request.json.get('email')
    if email not in users_db:
        return jsonify({'error': 'User not found'}), 404

    user = users_db[email]
    token = generate_token()
    hashed_token = hash_token(token)
    expiry_time = datetime.datetime.utcnow() + datetime.timedelta(hours=1)

    # Store the token and its expiry in the database
    user['reset_token'] = {'token': hashed_token, 'expiry': expiry_time}

    # Send email with reset link (not implemented here)
    # Example: send_email(user['email'], f"Reset your password at {request.host_url}reset?token={token}")

    return jsonify({'message': 'Password reset token sent'}), 200

if __name__ == '__main__':
    app.run(debug=True)