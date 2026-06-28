import time
import math
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

# In-memory storage for tracking login attempts and lockouts
# Structure: { username: { 'failed_attempts': int, 'lockout_until': float (timestamp), 'consecutive_lockouts': int } }
login_tracker = {}

MAX_FAILED_ATTEMPTS = 5
BASE_LOCKOUT_DURATION = 15 * 60  # 15 minutes in seconds
MAX_BACKOFF_MULTIPLIER = 1024    # Cap the exponential backoff to prevent extremely long lockouts

def get_lockout_duration(consecutive_lockouts):
    """
    Calculate lockout duration with exponential backoff.
    Duration = BASE_LOCKOUT_DURATION * (2 ^ consecutive_lockouts)
    Capped at MAX_BACKOFF_MULTIPLIER times the base duration.
    """
    multiplier = min(2 ** consecutive_lockouts, MAX_BACKOFF_MULTIPLIER)
    return BASE_LOCKOUT_DURATION * multiplier

def check_account_status(username):
    """
    Check if an account is locked and handle lockout expiration.
    Returns: (is_locked, error_message)
    """
    if username not in login_tracker:
        return False, None
    
    user_data = login_tracker[username]
    current_time = time.time()
    
    # Check if account is currently locked
    if user_data['lockout_until'] > current_time:
        remaining_time = int(user_data['lockout_until'] - current_time)
        return True, f"Account temporarily unavailable. Please try again later."
    
    # If lockout has expired, reset failed attempts but keep track of consecutive lockouts for backoff
    if user_data['lockout_until'] > 0:
        user_data['failed_attempts'] = 0
        # Increment consecutive lockouts for exponential backoff calculation on next lockout
        user_data['consecutive_lockouts'] += 1
    
    return False, None

def record_failed_attempt(username):
    """
    Record a failed login attempt and potentially lock the account.
    """
    current_time = time.time()
    
    if username not in login_tracker:
        login_tracker[username] = {
            'failed_attempts': 0,
            'lockout_until': 0,
            'consecutive_lockouts': 0
        }
    
    user_data = login_tracker[username]
    
    # If account is already locked, just return (don't increment attempts)
    if user_data['lockout_until'] > current_time:
        return
    
    user_data['failed_attempts'] += 1
    
    # Check if max failed attempts reached
    if user_data['failed_attempts'] >= MAX_FAILED_ATTEMPTS:
        # Calculate lockout duration with exponential backoff
        lockout_duration = get_lockout_duration(user_data['consecutive_lockouts'])
        user_data['lockout_until'] = current_time + lockout_duration
        user_data['failed_attempts'] = 0  # Reset for next cycle

def authenticate_user(username, password):
    """
    Simulated authentication function.
    In a real application, this would verify against a database with hashed passwords.
    Returns True if credentials are valid, False otherwise.
    """
    # Example: hardcoded valid credentials for demonstration
    VALID_USERS = {
        'admin': 'securepassword123',
        'user1': 'mypassword456'
    }
    
    if username in VALID_USERS and VALID_USERS[username] == password:
        return True
    return False

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing username or password'}), 400
    
    username = data['username']
    password = data['password']
    
    # Check if account is locked
    is_locked, error_message = check_account_status(username)
    if is_locked:
        # Return generic error message to not reveal lockout status
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Attempt authentication
    if authenticate_user(username, password):
        # Successful login - reset failed attempts and consecutive lockouts
        if username in login_tracker:
            login_tracker[username]['failed_attempts'] = 0
            login_tracker[username]['consecutive_lockouts'] = 0
        
        return jsonify({'message': 'Login successful'}), 200
    else:
        # Failed authentication - record attempt
        record_failed_attempt(username)
        # Return generic error message to not reveal whether account exists or password is wrong
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/status/<username>', methods=['GET'])
def get_status(username):
    """
    Optional endpoint for debugging/testing purposes.
    In production, this should be protected and not expose internal state.
    """
    if username in login_tracker:
        user_data = login_tracker[username]
        current_time = time.time()
        is_locked = user_data['lockout_until'] > current_time
        
        return jsonify({
            'failed_attempts': user_data['failed_attempts'],
            'is_locked': is_locked,
            'lockout_until': user_data['lockout_until'],
            'consecutive_lockouts': user_data['consecutive_lockouts']
        }), 200
    else:
        return jsonify({'message': 'No login attempts recorded for this user'}), 404

if __name__ == '__main__':
    app.run(debug=True)