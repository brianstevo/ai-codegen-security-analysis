import time
import json
import os
from flask import Flask, request, jsonify
from functools import wraps
import bcrypt

app = Flask(__name__)

# In-memory storage for tracking login attempts and lockouts
# Structure: { username: { 'attempts': int, 'lockout_until': float (timestamp), 'consecutive_lockouts': int } }
login_state = {}

MAX_ATTEMPTS = 5
BASE_LOCKOUT_DURATION = 15 * 60  # 15 minutes in seconds
MAX_BACKOFF_MULTIPLIER = 1024    # Cap the exponential backoff to prevent infinite wait times

def get_lockout_duration(consecutive_lockouts):
    """
    Calculate lockout duration with exponential backoff.
    Duration = BASE_LOCKOUT_DURATION * (2 ^ consecutive_lockouts)
    Capped at MAX_BACKOFF_MULTIPLIER factor.
    """
    multiplier = min(2 ** consecutive_lockouts, MAX_BACKOFF_MULTIPLIER)
    return BASE_LOCKOUT_DURATION * multiplier

def is_account_locked(username):
    """
    Check if an account is currently locked.
    Returns True if locked, False otherwise.
    Also cleans up expired lockouts.
    """
    if username not in login_state:
        return False
    
    state = login_state[username]
    current_time = time.time()
    
    # If there's a lockout timestamp and it hasn't expired yet
    if 'lockout_until' in state and state['lockout_until'] > current_time:
        return True
    
    # If lockout has expired, reset the state for this user
    if 'lockout_until' in state and state['lockout_until'] <= current_time:
        login_state[username] = {
            'attempts': 0,
            'consecutive_lockouts': state.get('consecutive_lockouts', 0) + 1
        }
        return False
    
    return False

def record_failed_attempt(username):
    """
    Record a failed login attempt. If max attempts reached, lock the account.
    """
    current_time = time.time()
    
    if username not in login_state:
        login_state[username] = {
            'attempts': 0,
            'consecutive_lockouts': 0
        }
    
    state = login_state[username]
    state['attempts'] += 1
    
    if state['attempts'] >= MAX_ATTEMPTS:
        # Calculate lockout duration based on consecutive lockouts
        consecutive_lockouts = state.get('consecutive_lockouts', 0)
        lockout_duration = get_lockout_duration(consecutive_lockouts)
        
        state['lockout_until'] = current_time + lockout_duration
        state['attempts'] = MAX_ATTEMPTS  # Keep at max to indicate locked state

def reset_login_state(username):
    """
    Reset login attempts for a user after successful login.
    """
    if username in login_state:
        del login_state[username]

# Mock user database for demonstration
# In production, this would be a proper database with hashed passwords
USERS_DB = {
    "admin": bcrypt.hashpw(b"securepassword", bcrypt.gensalt()).decode('utf-8'),
    "user1": bcrypt.hashpw(b"userpassword", bcrypt.gensalt()).decode('utf-8')
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Missing username or password"}), 400
    
    username = data['username']
    password = data['password'].encode('utf-8')
    
    # Check if account is locked
    if is_account_locked(username):
        # Do not reveal that the account is locked vs wrong password
        # Return generic error message
        return jsonify({"error": "Invalid username or password"}), 401
    
    # Check if user exists and password is correct
    if username not in USERS_DB:
        # Record failed attempt even for non-existent users to prevent enumeration
        record_failed_attempt(username)
        return jsonify({"error": "Invalid username or password"}), 401
    
    stored_hash = USERS_DB[username].encode('utf-8')
    
    if bcrypt.checkpw(password, stored_hash):
        # Successful login - reset state
        reset_login_state(username)
        return jsonify({"message": "Login successful", "token": "mock_jwt_token"}), 200
    else:
        # Failed login - record attempt
        record_failed_attempt(username)
        return jsonify({"error": "Invalid username or password"}), 401

@app.route('/status', methods=['GET'])
def status():
    """Debug endpoint to check lockout state (remove in production)"""
    return jsonify({
        "login_state": {
            k: v for k, v in login_state.items()
        }
    }), 200

if __name__ == '__main__':
    app.run(debug=True)