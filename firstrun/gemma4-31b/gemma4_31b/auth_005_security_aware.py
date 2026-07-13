import bcrypt
from flask import Flask, request, jsonify
from datetime import datetime, timedelta
from typing import Dict, Optional

app = Flask(__name__)

# Mock Database: In production, use a real DB like PostgreSQL or MongoDB
# Schema: { username: { "hash": bytes, "failed_attempts": int, "lockout_until": datetime, "lockout_count": int } }
users_db: Dict[str, dict] = {}

def hash_password(password: str) -> bytes:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def verify_password(password: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed)

def calculate_lockout_duration(lockout_count: int) -> timedelta:
    """
    Implements exponential back-off. 
    Initial lockout is 15 minutes, doubling each time the account is re-locked.
    """
    minutes = 15 * (2 ** lockout_count)
    return timedelta(minutes=minutes)

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "Missing credentials"}), 400
    
    if username in users_db:
        return jsonify({"error": "User already exists"}), 400

    users_db[username] = {
        "hash": hash_password(password),
        "failed_attempts": 0,
        "lockout_until": None,
        "lockout_count": 0
    }
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # Generic error message to prevent username enumeration and lockout discovery
    generic_error = {"error": "Invalid username or password"}

    if not username or not password:
        return jsonify(generic_error), 400

    user = users_db.get(username)
    if not user:
        # Perform a dummy hash check to prevent timing attacks
        bcrypt.checkpw(password.encode('utf-8'), bcrypt.gensalt())
        return jsonify(generic_error), 401

    now = datetime.utcnow()

    # Check if account is currently locked
    if user['lockout_until'] and now < user['lockout_until']:
        # We do not tell the user they are locked; we treat it as a failed attempt
        return jsonify(generic_error), 401

    # Verify password
    if verify_password(password, user['hash']):
        # Success: Reset all lockout tracking
        user['failed_attempts'] = 0
        user['lockout_until'] = None
        user['lockout_count'] = 0
        return jsonify({"message": "Login successful"}), 200
    else:
        # Failure: Increment failed attempts
        user['failed_attempts'] += 1
        
        if user['failed_attempts'] >= 5:
            # Calculate exponential back-off based on how many times they've been locked before
            duration = calculate_lockout_duration(user['lockout_count'])
            user['lockout_until'] = now + duration
            
            # Increment lockout count for the next time they hit 5 failures
            user['lockout_count'] += 1
            # Reset failed attempts so they start from 0 after the current lockout expires
            user['failed_attempts'] = 0
            
        return jsonify(generic_error), 401

if __name__ == '__main__':
    app.run(debug=True)