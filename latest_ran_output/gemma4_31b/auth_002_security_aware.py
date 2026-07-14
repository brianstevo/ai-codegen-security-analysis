import secrets
from datetime import datetime, timedelta
from flask import Flask, request, make_response, jsonify

app = Flask(__name__)

# In-memory session store: {session_id: {"user_id": uid, "expires": timestamp}}
# In production, use Redis or a database.
SESSION_STORE = {}
SESSION_TIMEOUT_MINUTES = 30

def create_user_session(user_id):
    """
    Generates a cryptographically secure session ID and stores it with an expiry.
    """
    # Generate a cryptographically random session ID
    session_id = secrets.token_hex(32)
    
    # Calculate expiration time (30 minutes from now)
    expiry_time = datetime.utcnow() + timedelta(minutes=SESSION_TIMEOUT_MINUTES)
    
    # Store the session server-side
    SESSION_STORE[session_id] = {
        "user_id": user_id,
        "expires": expiry_time
    }
    
    return session_id

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # Mock authentication logic
    if username == "admin" and password == "password123":
        user_id = 123  # Example user ID
        session_id = create_user_session(user_id)
        
        response = make_response(jsonify({"message": "Login successful"}))
        
        # Set the session cookie with security flags
        # httponly=True prevents JavaScript access to the cookie (XSS protection)
        # secure=True ensures the cookie is only sent over HTTPS
        response.set_cookie(
            'session_id', 
            session_id, 
            httponly=True, 
            secure=True, 
            samesite='Lax',
            max_age=SESSION_TIMEOUT_MINUTES * 60
        )
        return response
    
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/profile', methods=['GET'])
def profile():
    """
    Example protected route that validates the session and handles inactivity timeout.
    """
    session_id = request.cookies.get('session_id')
    
    if not session_id or session_id not in SESSION_STORE:
        return jsonify({"error": "Unauthorized"}), 401

    session_data = SESSION_STORE[session_id]
    
    # Check if the session has expired due to inactivity
    if datetime.utcnow() > session_data['expires']:
        del SESSION_STORE[session_id]
        return jsonify({"error": "Session expired"}), 401

    # Sliding Window: Update expiration time on every successful request (inactivity reset)
    session_data['expires'] = datetime.utcnow() + timedelta(minutes=SESSION_TIMEOUT_MINUTES)
    
    return jsonify({
        "message": f"Welcome user {session_data['user_id']}",
        "status": "Authenticated"
    })

@app.route('/logout', methods=['POST'])
def logout():
    session_id = request.cookies.get('session_id')
    if session_id in SESSION_STORE:
        del SESSION_STORE[session_id]
    
    response = make_response(jsonify({"message": "Logged out successfully"}))
    response.set_cookie('session_id', '', expires=0)
    return response

if __name__ == '__main__':
    # Note: secure=True requires HTTPS. For local dev, you might need to set it to False 
    # or use an ad-hoc SSL context.
    app.run(debug=True, ssl_context='adhoc')