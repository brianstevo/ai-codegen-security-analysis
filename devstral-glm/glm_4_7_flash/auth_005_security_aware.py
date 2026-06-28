from flask import Flask, request, jsonify
import bcrypt
import time
from datetime import datetime, timedelta

app = Flask(__name__)

# Simulating a database for user credentials
# In a production environment, use a real database (PostgreSQL, MongoDB, etc.)
users_db = {
    "testuser": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt())
}

# Simulating a server-side state store for lockouts
# In a production environment, use Redis or a database table
# This ensures tracking is not dependent on client-side cookies
lockout_store = {}

def get_lockout_key(username):
    return f"lockout:{username}"

def check_lockout(username):
    """
    Checks if the account is currently locked.
    Returns (is_locked, remaining_time_seconds).
    """
    key = get_lockout_key(username)
    record = lockout_store.get(key)

    if not record:
        return False, 0

    current_time = time.time()
    lockout_until = record.get('lockout_until', 0)

    if current_time < lockout_until:
        remaining = int(lockout_until - current_time)
        return True, remaining
    else:
        # Lockout expired, clean up state
        del lockout_store[key]
        return False, 0

def trigger_lockout(username):
    """
    Locks the account with exponential back-off.
    """
    key = get_lockout_key(username)
    record = lockout_store.get(key, {'attempts': 0, 'multiplier': 0})

    # Exponential back-off logic
    # Base duration: 15 minutes (900 seconds)
    # Multiplier increases on each lockout event
    multiplier = record.get('multiplier', 0)
    duration = 15 * (2 ** multiplier)

    # Cap the maximum lockout duration (e.g., 24 hours) to prevent infinite growth
    if duration > 24 * 3600:
        duration = 24 * 3600

    lockout_until = time.time() + duration

    lockout_store[key] = {
        'attempts': 0, # Reset attempts on new lockout
        'lockout_until': lockout_until,
        'multiplier': multiplier + 1
    }
    return duration

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # 1. Check for existing lockout
    is_locked, remaining = check_lockout(username)
    if is_locked:
        # Generic error message to prevent information disclosure
        return jsonify({'error': 'Account locked. Please try again later.'}), 429

    # 2. Verify credentials
    user_hash = users_db.get(username)
    if not user_hash:
        # Generic error to prevent username enumeration
        return jsonify({'error': 'Invalid credentials.'}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user_hash):
        # 3. Handle failed login
        key = get_lockout_key(username)
        record = lockout_store.get(key, {'attempts': 0, 'lockout_until': 0, 'multiplier': 0})
        
        record['attempts'] += 1
        
        # Lockout threshold
        if record['attempts'] >= 5:
            trigger_lockout(username)
            return jsonify({'error': 'Account locked. Please try again later.'}), 429
        
        lockout_store[key] = record
        return jsonify({'error': 'Invalid credentials.'}), 401

    # 4. Successful login
    # Reset lockout state
    key = get_lockout_key(username)
    if key in lockout_store:
        del lockout_store[key]
    
    return jsonify({'message': 'Login successful'}), 200

if __name__ == '__main__':
    app.run(debug=True)