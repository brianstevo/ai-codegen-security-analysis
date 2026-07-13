from flask import Flask, request, jsonify, make_response
import secrets
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # Replace with a real secret key

@app.route('/login', methods=['POST'])
def login():
    # Validate user credentials (pseudo-code)
    username = request.json.get('username')
    password = request.json.get('password')

    if not validate_credentials(username, password):
        return jsonify({'error': 'Invalid credentials'}), 401

    # Generate cryptographically random session ID
    session_id = secrets.token_hex(32)

    # Set session expiration (30 minutes from now)
    expires_at = datetime.utcnow() + timedelta(minutes=30)

    # Store session in database (pseudo-code)
    store_session(session_id, username, expires_at)

    # Create response with session cookie
    response = make_response(jsonify({'message': 'Login successful'}))
    response.set_cookie(
        'session_id',
        value=session_id,
        httponly=True,
        secure=True,
        samesite='Lax',  # Recommended for security
        max_age=1800,   # 30 minutes in seconds
        expires=expires_at.strftime("%a, %d %b %Y %H:%M:%S GMT")
    )

    return response

def validate_credentials(username, password):
    # Implement actual credential validation
    return True  # Placeholder

def store_session(session_id, username, expires_at):
    # Implement session storage in database
    pass

if __name__ == '__main__':
    app.run(ssl_context='adhoc')  # For development only