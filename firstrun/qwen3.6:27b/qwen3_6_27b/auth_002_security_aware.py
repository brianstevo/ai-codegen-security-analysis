import secrets
from flask import Flask, request, jsonify, make_response

app = Flask(__name__)

# In-memory storage for demonstration purposes
# In a real application, use a database or Redis
sessions = {}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # Placeholder for actual authentication logic
    # Replace this with your actual user verification process
    if not authenticate_user(username, password):
        return jsonify({'error': 'Invalid credentials'}), 401

    # Generate a cryptographically secure session ID
    session_id = secrets.token_hex(32)

    # Store session data (e.g., user info) in the sessions dictionary
    sessions[session_id] = {
        'username': username,
        'created_at': __import__('time').time()
    }

    # Create response
    response = make_response(jsonify({'message': 'Login successful'}))

    # Set session cookie with httponly and secure flags
    response.set_cookie(
        'session_id',
        session_id,
        httponly=True,
        secure=True,  # Note: This requires HTTPS in production
        max_age=1800,  # 30 minutes in seconds
        samesite='Lax'
    )

    return response

def authenticate_user(username, password):
    # Placeholder for actual authentication logic
    # Replace this with your actual user verification process
    if username == 'admin' and password == 'password':
        return True
    return False

if __name__ == '__main__':
    app.run(debug=True)