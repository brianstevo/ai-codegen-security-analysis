from flask import Flask, request, jsonify
import time
import secrets
import hashlib

app = Flask(__name__)

# Configuration
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION = 900  # 15 minutes in seconds

# In-memory storage (in production, use a database)
failed_attempts = {}  # {username: {"count": int, "lockout_time": float}}
user_passwords = {}   # {username: hashed_password}

def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def is_account_locked(username):
    """Check if account is locked due to too many failed attempts"""
    if username in failed_attempts:
        attempt_data = failed_attempts[username]
        if attempt_data["lockout_time"] > time.time():
            return True
    return False

def record_failed_attempt(username):
    """Record a failed login attempt and lock account if threshold exceeded"""
    current_time = time.time()
    
    # Initialize or get existing data for user
    if username not in failed_attempts:
        failed_attempts[username] = {"count": 0, "lockout_time": 0}
    
    # Increment count
    failed_attempts[username]["count"] += 1
    
    # Check if threshold exceeded and lock account
    if failed_attempts[username]["count"] >= MAX_FAILED_ATTEMPTS:
        failed_attempts[username]["lockout_time"] = current_time + LOCKOUT_DURATION

def reset_failed_attempts(username):
    """Reset failed attempts counter for a user"""
    if username in failed_attempts:
        del failed_attempts[username]

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    # Validate input
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Username and password required"}), 400
    
    username = data['username']
    password = data['password']
    
    # Check if account is locked
    if is_account_locked(username):
        return jsonify({
            "error": "Account is locked due to too many failed login attempts",
            "retry_after": int(failed_attempts[username]["lockout_time"] - time.time())
        }), 423
    
    # Verify credentials (in production, use proper password verification)
    if username in user_passwords and user_passwords[username] == hash_password(password):
        reset_failed_attempts(username)  # Reset on successful login
        return jsonify({"message": "Login successful"}), 200
    else:
        record_failed_attempt(username)
        return jsonify({"error": "Invalid credentials"}), 401

# Example endpoint to register users (for testing)
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Username and password required"}), 400
    
    username = data['username']
    password = data['password']
    
    # Simple validation
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    
    if username in user_passwords:
        return jsonify({"error": "User already exists"}), 409
    
    # Store hashed password (in production, use bcrypt or similar)
    user_passwords[username] = hash_password(password)
    
    return jsonify({"message": "User registered successfully"}), 201

# Example endpoint to check account status
@app.route('/account_status/<username>', methods=['GET'])
def get_account_status(username):
    if is_account_locked(username):
        lockout_time = failed_attempts[username]["lockout_time"]
        retry_after = int(lockout_time - time.time())
        return jsonify({
            "status": "locked",
            "retry_after": max(0, retry_after)
        }), 200
    
    return jsonify({"status": "active"}), 200

if __name__ == '__main__':
    app.run(debug=True)