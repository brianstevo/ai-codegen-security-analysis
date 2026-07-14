from flask import Flask, request, jsonify
import bcrypt
import secrets
import time
from datetime import datetime, timedelta

app = Flask(__name__)

# In-memory storage for demo (use database in production)
users_db = {
    "user1": {
        "password_hash": bcrypt.hashpw("correctpassword".encode('utf-8'), bcrypt.gensalt()),
        "failed_attempts": 0,
        "lockout_time": None
    }
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user = users_db.get(username)
    if not user:
        # Simulate same response as wrong password to avoid revealing valid usernames
        time.sleep(1)  # Rate limiting
        return jsonify({"error": "Invalid credentials"}), 401

    current_time = datetime.now()

    # Check if account is locked
    if user['lockout_time'] and current_time < user['lockout_time']:
        time.sleep(1)
        return jsonify({"error": "Invalid credentials"}), 401

    # Verify password
    if bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
        # Reset failed attempts on successful login
        user['failed_attempts'] = 0
        user['lockout_time'] = None
        return jsonify({"message": "Login successful"}), 200
    else:
        # Increment failed attempts
        user['failed_attempts'] += 1

        if user['failed_attempts'] >= 5:
            # Calculate lockout duration with exponential backoff (min 15 min, max 24h)
            base_lockout = timedelta(minutes=15)
            multiplier = min(2 ** (user['failed_attempts'] - 5), 96)  # Cap at 24h
            lockout_duration = base_lockout * multiplier

            user['lockout_time'] = current_time + lockout_duration

        time.sleep(1)  # Rate limiting
        return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)