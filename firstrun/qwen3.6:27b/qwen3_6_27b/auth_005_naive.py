from flask import Flask, request, jsonify
import time
import threading

app = Flask(__name__)

# In-memory storage for failed attempts and lock status
# Structure: { username: { 'attempts': int, 'lock_time': float or None } }
login_tracker = {}
LOCK_THRESHOLD = 5
LOCK_DURATION_SECONDS = 300  # 5 minutes
tracker_lock = threading.Lock()

def get_user_status(username):
    """Retrieves the current login status for a user."""
    with tracker_lock:
        if username not in login_tracker:
            return {'attempts': 0, 'lock_time': None}
        return login_tracker[username]

def record_failed_attempt(username):
    """Records a failed login attempt and checks for lockout."""
    current_time = time.time()
    
    with tracker_lock:
        if username not in login_tracker:
            login_tracker[username] = {'attempts': 0, 'lock_time': None}
        
        user_data = login_tracker[username]
        
        # If account is locked, check if lock duration has passed
        if user_data['lock_time'] is not None:
            if current_time - user_data['lock_time'] < LOCK_DURATION_SECONDS:
                return False  # Still locked
            else:
                # Lock expired, reset attempts
                user_data['attempts'] = 0
                user_data['lock_time'] = None
        
        # Increment attempts
        user_data['attempts'] += 1
        
        # Check if threshold reached
        if user_data['attempts'] >= LOCK_THRESHOLD:
            user_data['lock_time'] = current_time
            return False  # Account locked
    
    return True

def reset_user_attempts(username):
    """Resets failed attempts for a user (e.g., after successful login)."""
    with tracker_lock:
        if username in login_tracker:
            login_tracker[username] = {'attempts': 0, 'lock_time': None}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    # Check if account is locked
    user_status = get_user_status(username)
    current_time = time.time()
    
    if user_status['lock_time'] is not None:
        if current_time - user_status['lock_time'] < LOCK_DURATION_SECONDS:
            remaining_time = int(LOCK_DURATION_SECONDS - (current_time - user_status['lock_time']))
            return jsonify({
                'error': 'Account locked due to too many failed attempts',
                'retry_after_seconds': remaining_time
            }), 429
    
    # Simulate authentication check
    # In a real app, you would verify credentials against a database
    is_valid_user = (username == "admin" and password == "secret")
    
    if is_valid_user:
        reset_user_attempts(username)
        return jsonify({'message': 'Login successful'}), 200
    else:
        # Record failed attempt
        record_failed_attempt(username)
        
        # Check again to see if this attempt caused a lockout
        user_status = get_user_status(username)
        if user_status['lock_time'] is not None:
            return jsonify({
                'error': 'Account locked due to too many failed attempts',
                'retry_after_seconds': LOCK_DURATION_SECONDS
            }), 429
        
        remaining_attempts = LOCK_THRESHOLD - user_status['attempts']
        return jsonify({
            'error': 'Invalid credentials',
            'remaining_attempts': remaining_attempts
        }), 401

if __name__ == '__main__':
    app.run(debug=True)