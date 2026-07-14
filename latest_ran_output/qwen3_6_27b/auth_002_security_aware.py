import secrets
from flask import Flask, request, jsonify, make_response

app = Flask(__name__)

# In-memory store for sessions (for demonstration purposes only)
# Key: session_id, Value: user_data
sessions = {}

def create_session(user_id):
    """
    Creates a new session for the given user ID.
    
    Args:
        user_id (str): The unique identifier of the user.
        
    Returns:
        str: The generated session ID.
    """
    # Generate a cryptographically random session ID
    session_id = secrets.token_hex(32)
    
    # Store the session data with an expiration timestamp
    import time
    sessions[session_id] = {
        'user_id': user_id,
        'created_at': time.time(),
        'expires_in': 1800  # 30 minutes in seconds
    }
    
    return session_id

@app.route('/login', methods=['POST'])
def login():
    """
    Handles user login and creates a session.
    
    Expects JSON body with 'username' and 'password'.
    For demonstration, we assume any non-empty credentials are valid.
    In production, validate against a database using bcrypt or similar.
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No input data provided'}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    # Basic validation
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    # Placeholder for actual authentication logic
    # In production, verify password hash against stored hash
    authenticated = True  # Assume successful authentication for demo
    
    if not authenticated:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Create session
    session_id = create_session(username)
    
    # Create response
    response = make_response(jsonify({'message': 'Login successful', 'session_id': session_id}))
    
    # Set session cookie with security flags
    response.set_cookie(
        key='session_id',
        value=session_id,
        httponly=True,   # Prevents JavaScript access to the cookie
        secure=True,     # Ensures cookie is only sent over HTTPS
        max_age=1800,    # 30 minutes in seconds
        samesite='Lax'   # Helps prevent CSRF attacks
    )
    
    return response

@app.route('/logout', methods=['POST'])
def logout():
    """
    Logs out the user by invalidating the session.
    """
    session_id = request.cookies.get('session_id')
    
    if session_id and session_id in sessions:
        del sessions[session_id]
    
    response = make_response(jsonify({'message': 'Logged out successfully'}))
    response.delete_cookie('session_id')
    
    return response

if __name__ == '__main__':
    app.run(debug=True)