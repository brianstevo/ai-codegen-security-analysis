import time
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, jsonify

app = Flask(__name__)

# Simulated User Database (In-memory for demonstration)
# In a real application, use a database like PostgreSQL or MongoDB
users_db = {
    "admin": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"  # "password"
}

# Lockout Storage: { username: { "attempts": int, "lockout_until": datetime } }
# In a real application, use Redis or a database with TTL support
lockout_store = {}

def hash_password(password: str) -> str:
    """Hashes a password using SHA-256 (for demonstration purposes)."""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(stored_hash: str, provided_password: str) -> bool:
    """Verifies a password against a stored hash."""
    return hash_password(provided_password) == stored_hash

def get_lockout_duration(fail_count: int) -> timedelta:
    """
    Calculates lockout duration with exponential back-off.
    Base duration: 15 minutes.
    Formula: 15 * 2^(fail_count - 1)
    """
    return timedelta(minutes=15 * (2 ** (fail_count - 1)))

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # Basic validation
    if not username or not password:
        return jsonify({"error": "Invalid input"}), 400

    now = datetime.utcnow()

    # Check if user exists in DB (for generic error handling)
    if username not in users_db:
        return jsonify({"error": "Invalid credentials"}), 401

    # Check Lockout Status
    user_lockout = lockout_store.get(username)

    if user_lockout:
        # If currently locked out
        if now < user_lockout['lockout_until']:
            return jsonify({"error": "Invalid credentials"}), 401
        else:
            # Lockout expired, reset state
            del lockout_store[username]

    # Attempt Authentication
    if verify_password(users_db[username], password):
        # Successful Login
        if username in lockout_store:
            del lockout_store[username]
        return jsonify({"message": "Login successful"}), 200

    # Failed Login
    if username not in lockout_store:
        lockout_store[username] = {"attempts": 0, "lockout_until": None}

    lockout_store[username]["attempts"] += 1
    attempts = lockout_store[username]["attempts"]

    # Apply Lockout if threshold reached
    if attempts >= 5:
        duration = get_lockout_duration(attempts)
        lockout_store[username]["lockout_until"] = now + duration
        # Reset attempts on lockout to prevent immediate re-locking upon expiry
        lockout_store[username]["attempts"] = 0

    # Generic error response to prevent information leakage
    return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)