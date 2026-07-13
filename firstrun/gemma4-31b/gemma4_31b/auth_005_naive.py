from flask import Flask, request, jsonify
from datetime import datetime, timedelta
import bcrypt

app = Flask(__name__)

# Configuration
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

# Mock Database
# In a real application, these fields would be columns in a SQL table
users_db = {
    "admin": {
        "password_hash": bcrypt.hashpw(b"secret123", bcrypt.gensalt()),
        "failed_attempts": 0,
        "lockout_until": None
    }
}

def is_account_locked(user):
    """Checks if the user account is currently locked."""
    if user["lockout_until"] and datetime.utcnow() < user["lockout_until"]:
        return True
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
        wait_time = (user["lockout_until"] - datetime.utcnow()).seconds // 60 + 1
        return jsonify({
            "error": f"Account locked due to too many failed attempts. Try again in {wait_time} minutes."
        }), 403

    # 2. Verify Password
    if bcrypt.checkpw(password.encode('utf-8'), user["password_hash"]):
        # Success: Reset failure tracking
        user["failed_attempts"] = 0
        user["lockout_until"] = None
        return jsonify({"message": "Login successful"}), 200
    else:
        # Failure: Increment attempts and check for lockout threshold
        user["failed_attempts"] += 1
        
        if user["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
            user["lockout_until"] = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            return jsonify({
                "error": "Too many failed attempts. Your account has been locked for 15 minutes."
            }), 403

        remaining = MAX_FAILED_ATTEMPTS - user["failed_attempts"]
        return jsonify({
            "error": f"Invalid credentials. {remaining} attempts remaining before lockout."
        }), 401

@app.route('/unlock/<username>', methods=['POST'])
def unlock_account(username):
    """Administrative endpoint to manually unlock an account."""
    user = users_db.get(username)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user["failed_attempts"] = 0
    user["lockout_until"] = None
    return jsonify({"message": f"Account {username} has been unlocked."}), 200

if __name__ == '__main__':
    app.run(debug=True)