import time
import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
import bcrypt
import threading

app = Flask(__name__)

# In-memory storage for login attempts (in production, use Redis or similar)
login_attempts = {}
lockouts = {}
lockout_counts = {}

# Constants
MAX_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 15 * 60  # 15 minutes

def get_lockout_duration(attempt_count):
    """Calculate exponential back-off duration for repeated lockouts"""
    if attempt_count <= 0:
        return LOCKOUT_DURATION_SECONDS
    
    # Exponential backoff: base duration * 2^(attempt_count - 1)
    # Cap at 24 hours to prevent excessive lockouts
    max_duration = 24 * 60 * 60  # 24 hours in seconds
    duration = LOCKOUT_DURATION_SECONDS * (2 ** (attempt_count - 1))
    return min(duration, max_duration)

def is_locked_out(username):
    """Check if account is currently locked out"""
    if username not in lockouts:
        return False
    
    lockout_time, count = lockouts[username]
    current_time = time.time()
    
    # Check if lockout has expired
    if current_time - lockout_time >= get_lockout_duration(count):
        # Reset after lockout expires
        del lockouts[username]
        return False
    
    return True

def record_failed_attempt(username):
    """Record a failed login attempt"""
    current_time = time.time()
    
    # Initialize tracking for user if not exists
    if username not in login_attempts:
        login_attempts[username] = []
    
    # Clean old attempts (older than 15 minutes)
    login_attempts[username] = [
        t for t in login_attempts[username] 
        if current_time - t < LOCKOUT_DURATION_SECONDS
    ]
    
    # Add new failed attempt timestamp
    login_attempts[username].append(current_time)
    
    # Check if we've reached the threshold
    if len(login_attempts[username]) >= MAX_ATTEMPTS:
        # Calculate lockout duration based on previous lockouts
        count = lockout_counts.get(username, 0) + 1
        
        # Set lockout
        lockouts[username] = (current_time, count)
        
        # Update lockout count for exponential backoff calculation
        lockout_counts[username] = count

def record_successful_login(username):
    """Record a successful login - reset failed attempts"""
    if username in login_attempts:
        del login_attempts[username]
    
    # Remove any existing lockouts on successful login
    if username in lockouts:
        del lockouts[username]

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Invalid request"}), 400
    
    username = data['username']
    password = data['password']
    
    # Check for lockout first
    if is_locked_out(username):
        return jsonify({
            "error": "Account temporarily locked due to multiple failed login attempts"
        }), 423
    
    # Simulate database lookup (in production, use actual user storage)
    # For demo purposes - in real app you'd fetch from DB
    stored_hash = None
    if username == "testuser":
        stored_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt())
    
    # Check credentials
    if not stored_hash or not bcrypt.checkpw(password.encode('utf-8'), stored_hash):
        # Record failed attempt
        record_failed_attempt(username)
        
        # Return generic error message to avoid revealing lockout status
        return jsonify({
            "error": "Invalid username or password"
        }), 401
    
    # Successful login - reset tracking
    record_successful_login(username)
    
    # In real app, generate and return JWT token here
    return jsonify({"message": "Login successful"}), 200

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy"}), 200

# For testing purposes - reset all tracking data
@app.route('/reset-tracking', methods=['POST'])
def reset_tracking():
    global login_attempts, lockouts, lockout_counts
    login_attempts = {}
    lockouts = {}
    lockout_counts = {}
    return jsonify({"message": "Tracking data reset"}), 200

if __name__ == '__main__':
    app.run(debug=True)