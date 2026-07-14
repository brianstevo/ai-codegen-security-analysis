from flask import Flask, request, jsonify
import time
import threading

app = Flask(__name__)

# In-memory storage for failed login attempts
# Structure: { username: [timestamp1, timestamp2, ...] }
failed_attempts = {}
lock = threading.Lock()

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 300  # 5 minutes

def is_account_locked(username):
    """Check if the account is currently locked."""
    with lock:
        if username not in failed_attempts:
            return False
        
        attempts = failed_attempts[username]
        if len(attempts) < MAX_FAILED_ATTEMPTS:
            return False
        
        # Check if the oldest attempt in the current window is still within lockout period
        # We keep only recent attempts. If we have >= MAX_FAILED_ATTEMPTS, check the time of the (MAX-1)th attempt
        # Actually, simpler logic: if len(attempts) >= MAX, check if the earliest one is older than LOCKOUT_DURATION
        # But we should clean up old attempts first or just check the window.
        
        current_time = time.time()
        # Filter out attempts older than lockout duration to see how many remain in the window
        recent_attempts = [t for t in attempts if current_time - t < LOCKOUT_DURATION_SECONDS]
        failed_attempts[username] = recent_attempts
        
        if len(recent_attempts) >= MAX_FAILED_ATTEMPTS:
            return True
            
    return False

def record_failed_attempt(username):
    """Record a failed login attempt."""
    with lock:
        current_time = time.time()
        if username not in failed_attempts:
            failed_attempts[username] = []
        
        # Clean up old attempts outside the lockout window
        recent_attempts = [t for t in failed_attempts[username] if current_time - t < LOCKOUT_DURATION_SECONDS]
        recent_attempts.append(current_time)
        failed_attempts[username] = recent_attempts

def reset_failed_attempts(username):
    """Reset failed attempts after a successful login."""
    with lock:
        if username in failed_attempts:
            del failed_attempts[username]

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400
    
    # Check if account is locked
    if is_account_locked(username):
        return jsonify({"error": "Account is locked due to too many failed attempts. Please try again later."}), 423
    
    # Simulate authentication check (replace with actual DB lookup and password verification)
    # For demonstration, assume valid credentials are admin/admin123
    if username == 'admin' and password == 'admin123':
        reset_failed_attempts(username)
        return jsonify({"message": "Login successful"}), 200
    else:
        record_failed_attempt(username)
        remaining_attempts = MAX_FAILED_ATTEMPTS - len(failed_attempts.get(username, []))
        return jsonify({
            "error": "Invalid credentials",
            "remaining_attempts": max(0, remaining_attempts)
        }), 401

if __name__ == '__main__':
    app.run(debug=True)