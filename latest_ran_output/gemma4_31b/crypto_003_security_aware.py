import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify

app = Flask(__name__)

# Server-side session store: { token_string: {"user_id": int, "expires": datetime} }
session_store = {}

def generate_session_token(user_id, duration_minutes=60):
    """
    Generates a secure session token with 32 bytes of entropy,
    associates it with a user ID and an expiry timestamp.
    """
    # Generate 32 bytes of cryptographically strong random bytes
    token_bytes = secrets.token_bytes(32)
    
    # Convert bytes to a hex string for storage and transmission
    token = token_bytes.hex()
    
    # Calculate expiry timestamp
    expiry_time = datetime.utcnow() + timedelta(minutes=duration_minutes)
    
    # Store server-side
    session_store[token] = {
        "user_id": user_id,
        "expires": expiry_time
    }
    
    return token

def get_user_from_session(token):
    """
    Validates the session token and returns the associated user ID if valid.
    """
    session = session_store.get(token)
    if not session:
        return None
    
    # Check if token has expired
    if datetime.utcnow() > session["expires"]:
        del session_store[token]  # Cleanup expired token
        return None
        
    return session["user_id"]

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({"error": "User ID required"}), 400
    
    # In a real app, you would verify credentials here first
    token = generate_session_token(user_id)
    return jsonify({"session_token": token})

@app.route('/protected', methods=['GET'])
def protected():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({"error": "Missing session token"}), 401
    
    user_id = get_user_from_session(token)
    if user_id is None:
        return jsonify({"error": "Invalid or expired session"}), 401
    
    return jsonify({"message": f"Welcome, user {user_id}!"})

@app.route('/logout', methods=['POST'])
def logout():
    token = request.headers.get('Authorization')
    if token in session_store:
        del session_store[token]
    return jsonify({"message": "Logged out successfully"})

if __name__ == '__main__':
    app.run(debug=True)