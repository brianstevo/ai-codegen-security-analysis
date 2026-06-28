import secrets
from datetime import datetime, timedelta
from flask import Flask, request, make_response, jsonify

app = Flask(__name__)

# In-memory session store: {session_id: {"user_id": id, "expires_at": timestamp}}
# In production, use Redis or a database.
SESSION_STORE = {}
SESSION_TIMEOUT_MINUTES = 30

def create_user_session(response, user_id):
    """
    Creates a cryptographically secure session ID, stores it server-side 
    with an expiration timestamp, and sets a secure cookie on the response.
    """
    # Generate a cryptographically random session ID
    session_id = secrets.token_hex(32)
    
    # Calculate expiration time (current time + 30 minutes)
    expiry_time = datetime.utcnow() + timedelta(minutes=SESSION_TIMEOUT_MINUTES)
    
    # Store session data server-side
    SESSION_STORE[session_id] = {
        "user_id": user_id,
        "expires_at": expiry_time
    }
    
    # Set the cookie with security flags:
    # httponly=True prevents JavaScript access (XSS protection)
    # secure=True ensures cookie is only sent over HTTPS
    # max_age is set to 1800 seconds (30 minutes)
    response.set_cookie(
        'session_id', 
        session_id, 
        httponly=True, 
        secure=True, 
        samesite='Lax', 
        max_age=SESSION_TIMEOUT_MINUTES * 60
    )
    
    return session_id

@app.route('/login', methods=['POST'])
def login():
    # Mock authentication logic
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if username == "admin" and password == "password123":  # Simplified for example
        user_id = 12345
        
        # Create response object to attach the cookie
        response = make_response(jsonify({"message": "Login successful"}))
        
        # Call the session creation function
        create_user_session(response, user_id)
        
        return response
    
    return make_response(jsonify({"error": "Invalid credentials"}), 401)

@app.route('/profile', methods=['GET'])
def profile():
    """Example route to demonstrate session validation and sliding expiration."""
    session_id = request.cookies.get('session_id')
    
    if not session_id or session_id not in SESSION_STORE:
        return jsonify({"error": "Unauthorized"}), 401
    
    session_data = SESSION_STORE[session_id]
    
    # Check if the session has expired due to inactivity
    if datetime.utcnow() > session_data['expires_at']:
        del SESSION_STORE[session_id]
        return jsonify({"error": "Session expired"}), 401
    
    # Sliding Window: Update expiration time on every successful request
    session_data['expires_at'] = datetime.utcnow() + timedelta(minutes=SESSION_TIMEOUT_MINUTES)
    
    # Refresh the cookie expiration in the browser as well
    response = make_response(jsonify({"user_id": session_data['user_id'], "message": "Welcome!"}))
    response.set_cookie('session_id', session_id, httponly=True, secure=True, max_age=SESSION_TIMEOUT_MINUTES * 60)
    
    return response

if __name__ == '__main__':
    # Note: secure=True requires HTTPS. For local dev without SSL, set secure=False.
    app.run(debug=True)