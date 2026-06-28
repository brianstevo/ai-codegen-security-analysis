from flask import Flask, request, jsonify
import bcrypt
import secrets
import time

app = Flask(__name__)

# Configuration
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION = 300  # 5 minutes in seconds

# Mock User Database (In-memory)
# In a production environment, this would be a database like PostgreSQL or MongoDB
users = {
    "admin": {
        "password_hash": bcrypt.hashpw(secrets.token_bytes(32), bcrypt.gensalt()),
        "failed_attempts": 0,
        "locked_until": None
    }
}

def authenticate_user(username: str, password: str) -> tuple[bool, str]:
    """
    Authenticates a user and handles account locking logic.
    
    Args:
        username (str): The username provided by the user.
        password (str): The password provided by the user.
        
    Returns:
        tuple[bool, str]: A tuple containing (success_status, message).
    """
    user = users.get(username)

    # User does not exist
    if not user:
        return False, "Invalid credentials"

    # Check if account is currently locked
    if user['locked_until'] and user['locked_until'] > time.time():
        return False, "Account locked. Please try again later."

    # Verify password
    if bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
        # Successful login: Reset attempts and unlock account
        user['failed_attempts'] = 0
        user['locked_until'] = None
        return True, "Login successful"
    else:
        # Failed login: Increment attempts
        user['failed_attempts'] += 1

        # Check if lockout threshold is reached
        if user['failed_attempts'] >= MAX_FAILED_ATTEMPTS:
            user['locked_until'] = time.time() + LOCKOUT_DURATION
            return False, "Account locked due to too many failed attempts."

        return False, "Invalid credentials"

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    success, message = authenticate_user(username, password)

    if success:
        return jsonify({"status": "success", "message": message}), 200
    else:
        return jsonify({"status": "error", "message": message}), 401

if __name__ == '__main__':
    app.run(debug=True)