import datetime
from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

# Configuration
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

# Mock Database
# In a real app, these fields (failed_attempts, lockout_until) would be columns in your SQL table.
users_db = {
    "admin": {
        "password_hash": bcrypt.hashpw(b"secret123", bcrypt.gensalt()),
        "failed_attempts": 0,
        "lockout_until": None
    }
}

def is_account_locked(user):
    """Checks if the account is currently locked based on the lockout timestamp."""
    if user["lockout_until"] is None:
        return False
    
    if datetime.datetime.utcnow() < user["lockout_until"]:
        return True
    
    # Lock expired, reset attempts automatically upon next check if desired, 
    # or handle it during the login logic.
    return False

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user = users_db.get(username)
    if not user:
        # Generic error to prevent username enumeration
        return jsonify({"error": "Invalid credentials"}), 401

    # 1. Check if account is locked
    if is_account_locked(user):
        wait_time = (user["lockout_until"] - datetime.datetime.utcnow()).total_seconds()
        minutes = int(wait_time // 60) + 1
        return jsonify({
            "error": f"Account locked due to too many failed attempts. Please try again in {minutes} minutes."
        }), 403

    # 2. Verify Password
    if bcrypt.checkpw(password.encode('utf-8'), user["password_hash"]):
        # SUCCESS: Reset failure tracking
        user["failed_attempts"] = 0
        user["lockout_until"] = None
        return jsonify({"message": "Login successful", "token": "mock-jwt-token"}), 200
    else:
        # FAILURE: Increment attempts
        user["failed_attempts"] += 1
        
        if user["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
            # Lock the account
            lockout_time = datetime.datetime.utcnow() + datetime.timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            user["lockout_until"] = lockout_time
            return jsonify({
                "error": f"Too many failed attempts. Account locked for {LOCKOUT_DURATION_MINUTES} minutes."
            }), 403
        
        remaining = MAX_FAILED_ATTEMPTS - user["failed_attempts"]
        return jsonify({
            "error": f"Invalid credentials. {remaining} attempts remaining before lockout."
        }), 401

if __name__ == '__main__':
    app.run(debug=True)