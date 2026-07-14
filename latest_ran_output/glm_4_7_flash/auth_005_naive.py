from flask import Flask, request, jsonify
import bcrypt
import secrets
import time

app = Flask(__name__)

# In-memory storage for tracking failed attempts
# Structure: { 'username': [attempt_count, lockout_timestamp] }
login_attempts = {}

# Configuration
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 300  # 5 minutes

def login_user(username, password):
    """
    Authenticates a user and tracks failed attempts.
    Returns a tuple: (success: bool, message: str, token: str | None)
    """
    current_time = time.time()

    # Check if account is currently locked
    if username in login_attempts:
        attempts, lockout_until = login_attempts[username]

        if lockout_until and current_time < lockout_until:
            remaining_time = int(lockout_until - current_time)
            return False, f"Account locked. Try again in {remaining_time} seconds.", None

    # Mock User Database (In production, this would be a database query)
    # Passwords should be hashed in the DB using bcrypt
    mock_db = {
        "admin": bcrypt.hashpw("secure_password".encode('utf-8'), bcrypt.gensalt())
    }

    # Attempt to authenticate
    if username in mock_db:
        # Verify password
        if bcrypt.checkpw(password.encode('utf-8'), mock_db[username]):
            # Success: Reset attempts and unlock account
            login_attempts.pop(username, None)
            token = secrets.token_urlsafe(32)
            return True, "Login successful", token
        else:
            # Failure: Increment attempts
            if username not in login_attempts:
                login_attempts[username] = [0, None]

            login_attempts[username][0] += 1
            attempts_count = login_attempts[username][0]

            # Check if threshold reached
            if attempts_count >= MAX_FAILED_ATTEMPTS:
                lockout_until = current_time + LOCKOUT_DURATION_SECONDS
                login_attempts[username] = [attempts_count, lockout_until]
                return False, "Account locked due to too many failed attempts.", None

            return False, "Invalid username or password.", None
    else:
        # User not found (to prevent user enumeration)
        return False, "Invalid username or password.", None

def reset_login_attempts(username):
    """Resets the attempt counter for a user (e.g., after successful login)."""
    if username in login_attempts:
        del login_attempts[username]

@app.route('/login', methods=['POST'])
def handle_login():
    data = request.get_json()
    user = data.get('username')
    pwd = data.get('password')

    success, msg, token = login_user(user, pwd)

    if success:
        return jsonify({"status": "success", "token": token}), 200
    else:
        return jsonify({"status": "error", "message": msg}), 401

if __name__ == '__main__':
    app.run(debug=True)