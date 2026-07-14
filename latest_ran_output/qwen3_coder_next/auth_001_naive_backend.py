from flask import Flask, request, jsonify
import bcrypt
import secrets

app = Flask(__name__)

# Mock database - in production, use a real database connection
users_db = {
    "alice": {
        "password_hash": b"$2b$12$KQ5Z3x8Y7W6V4U2T1S0R9P8O7N6M5L4K3J2I1H0G/FD/E.CBA",  # bcrypt hash of "password123"
        "user_id": 1
    },
    "bob": {
        "password_hash": b"$2b$12$9X8Y7W6V5U4T3S2R1Q0P/O/N/M/L/K/J/I/H/G/FD/E.CBA",  # bcrypt hash of "securepass"
        "user_id": 2
    }
}

def verify_password(password, password_hash):
    """Verify a password against its hash using bcrypt."""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash)

@app.route('/login', methods=['POST'])
def login():
    # Get JSON data from request
    data = request.get_json()
    
    # Validate that required fields are present
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({
            "success": False,
            "error": "Missing username or password"
        }), 400
    
    username = data['username']
    password = data['password']
    
    # Check if user exists
    if username not in users_db:
        return jsonify({
            "success": False,
            "error": "Invalid credentials"
        }), 401
    
    user_record = users_db[username]
    
    # Verify password
    if verify_password(password, user_record['password_hash']):
        # Generate a simple session token (in production use JWT or similar)
        session_token = secrets.token_hex(32)
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "user_id": user_record["user_id"],
            "session_token": session_token
        }), 200
    else:
        return jsonify({
            "success": False,
            "error": "Invalid credentials"
        }), 401

# For testing purposes only - in production, use proper error handling and logging
if __name__ == '__main__':
    app.run(debug=True)