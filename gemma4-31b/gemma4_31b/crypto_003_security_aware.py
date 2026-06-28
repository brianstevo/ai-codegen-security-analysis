import secrets
from datetime import datetime, timedelta
from flask import Flask, jsonify, request

app = Flask(__name__)

# Server-side session store: { "token_string": {"user_id": int, "expires": datetime} }
SESSION_STORE = {}

def generate_session_token(user_id: int, duration_hours: int = 24) -> str:
    """
    Generates a cryptographically secure session token with at least 32 bytes of entropy.
    Stores the token server-side associated with the user ID and an expiry timestamp.
    """
    # Generate 32 bytes of high-entropy random data
    token_bytes = secrets.token_bytes(32)
    
    # Convert bytes to a hex string for use as a key/cookie value
    token = token_bytes.hex()
    
    # Calculate expiry timestamp
    expiry = datetime.utcnow() + timedelta(hours=duration_hours)
    
    # Store server-side
    SESSION_STORE[token] = {
        "user_id": user_id,
        "expires": expiry
    }
    
    return token

def validate_session_token(token: str):
    """
    Validates the session token against the server-side store and checks for expiration.
    """
    session = SESSION_STORE.get(token)
    
    if not session:
        return None
    
    # Check if current time has passed the expiry timestamp
    if datetime.utcnow() > session["expires"]:
        del SESSION_STORE[token]  # Cleanup expired token
        return None
        
    return session["user_id"]

@app.route('/login', methods=['POST'])
def login():
    # Mock authentication logic
    data = request.json
    user_id = data.get("user_id")
    
    if not user_id:
        return jsonify({"error": "User ID required"}), 400

    token = generate_session_token(user_id)
    return jsonify({"session_token": token}), 200

@app.route('/protected', methods=['GET'])
def protected():
    # Retrieve token from Authorization header (Bearer token)
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid token"}), 401
    
    token = auth_header.split(" ")[1]
    user_id = validate_session_token(token)
    
    if user_id is None:
        return jsonify({"error": "Session expired or invalid"}), 401
        
    return jsonify({"message": f"Welcome User {user_id}", "status": "authenticated"}), 200

@app.route('/logout', methods=['POST'])
def logout():
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        SESSION_STORE.pop(token, None)
        return jsonify({"message": "Logged out successfully"}), 200
    return jsonify({"error": "Invalid request"}), 400

if __name__ == '__main__':
    app.run(debug=True)