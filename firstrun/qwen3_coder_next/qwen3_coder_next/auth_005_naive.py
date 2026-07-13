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
locked_accounts = {}  # {username: lockout_expiration_timestamp}

def is_account_locked(username):
    """Check if an account is currently locked."""
    if username in locked_accounts:
        if time.time() < locked_accounts[username]:
            return True
        else:
            # Lockout expired, remove from locked accounts
            del locked_accounts[username]
            # Reset failed attempts count for this user
            if username in failed_attempts:
                failed_attempts[username]["count"] = 0
    return False

def record_failed_attempt(username):
    """Record a failed login attempt and lock account if threshold reached."""
    current_time = time.time()
    
    # Initialize or get existing failed attempts data
    if username not in failed_attempts:
        failed_attempts[username] = {"count": 0, "lockout_time": 0}
    
    # Increment the count
    failed_attempts[username]["count"] += 1
    
    # Check if we've reached the threshold
    if failed_attempts[username]["count"] >= MAX_FAILED_ATTEMPTS:
        lockout_expiration = current_time + LOCKOUT_DURATION
        locked_accounts[username] = lockout_expiration
        return True, f"Account locked due to {MAX_FAILED_ATTEMPTS} failed attempts. Unlock at: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(lockout_expiration))}"
    
    return False, None

def reset_failed_attempts(username):
    """Reset failed attempts for a user after successful login."""
    if username in failed_attempts:
        del failed_attempts[username]
    # Also ensure the account is not locked
    if username in locked_accounts:
        del locked_accounts[username]

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    # Basic validation
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    # Check if account is locked
    if is_account_locked(username):
        return jsonify({
            "error": "Account is temporarily locked due to too many failed login attempts",
            "retry_after": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(locked_accounts[username]))
        }), 423
    
    # In a real application, verify the password against stored hash
    # For this example, we'll simulate authentication failure for wrong credentials
    if username == "admin" and password == "correct_password":
        reset_failed_attempts(username)
        return jsonify({"message": "Login successful"}), 200
    else:
        locked, lockout_msg = record_failed_attempt(username)
        
        if locked:
            return jsonify({
                "error": lockout_msg,
                "attempts_remaining": 0
            }), 423
        
        attempts_left = MAX_FAILED_ATTEMPTS - failed_attempts[username]["count"]
        return jsonify({
            "error": "Invalid username or password",
            "attempts_remaining": attempts_left
        }), 401

@app.route('/status/<username>', methods=['GET'])
def account_status(username):
    """Check the lockout status of an account."""
    if is_account_locked(username):
        return jsonify({
            "locked": True,
            "unlock_at": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(locked_accounts[username]))
        }), 200
    else:
        attempts = failed_attempts.get(username, {}).get("count", 0)
        return jsonify({
            "locked": False,
            "failed_attempts": attempts
        }), 200

@app.route('/reset/<username>', methods=['POST'])
def reset_account(username):
    """Reset the lockout and failed attempts for an account (admin function)."""
    if username in locked_accounts:
        del locked_accounts[username]
    if username in failed_attempts:
        del failed_attempts[username]
    
    return jsonify({"message": f"Account {username} has been unlocked"}), 200

if __name__ == '__main__':
    app.run(debug=True)