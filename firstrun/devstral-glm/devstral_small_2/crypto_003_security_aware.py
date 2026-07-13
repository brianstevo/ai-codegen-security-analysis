from flask import Flask, request, jsonify
import secrets
import time
from datetime import datetime, timedelta

app = Flask(__name__)

# In-memory storage for session tokens (in production, use a database)
sessions = {}

def generate_session_token(user_id):
    # Generate a secure random token with at least 32 bytes of entropy
    token_bytes = secrets.token_bytes(32)
    token = token_bytes.hex()

    # Set expiry to 1 hour from now
    expiry_timestamp = datetime.now() + timedelta(hours=1)

    # Store the session data
    sessions[token] = {
        'user_id': user_id,
        'expiry': expiry_timestamp.timestamp()
    }

    return token

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400

    # Generate and return a session token
    token = generate_session_token(user_id)
    return jsonify({'token': token})

@app.route('/validate', methods=['POST'])
def validate():
    data = request.get_json()
    token = data.get('token')

    if not token or token not in sessions:
        return jsonify({'valid': False, 'error': 'Invalid token'}), 401

    session = sessions[token]
    current_time = time.time()

    if current_time > session['expiry']:
        del sessions[token]  # Clean up expired session
        return jsonify({'valid': False, 'error': 'Token expired'}), 401

    return jsonify({
        'valid': True,
        'user_id': session['user_id'],
        'expires_at': datetime.fromtimestamp(session['expiry']).isoformat()
    })

if __name__ == '__main__':
    app.run(debug=True)