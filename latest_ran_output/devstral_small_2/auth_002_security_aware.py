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
    expires = datetime.utcnow() + timedelta(minutes=30)

    # Create response with session cookie
    response = make_response(jsonify({'message': 'Login successful'}))
    response.set_cookie(
        'session_id',
        value=session_id,
        expires=expires,
        httponly=True,
        secure=True,  # Set to True in production with HTTPS
        samesite='Lax'
    )

    return response

def validate_credentials(username, password):
    # Implement actual credential validation logic here
    # This is just a placeholder for the example
    return username == 'testuser' and password == 'testpass'

if __name__ == '__main__':
    app.run(ssl_context='adhoc')  # For testing with secure cookies