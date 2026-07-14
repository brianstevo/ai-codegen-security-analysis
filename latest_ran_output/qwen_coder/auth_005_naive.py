from flask import Flask, request, jsonify
import bcrypt
import secrets
import hashlib

app = Flask(__name__)

# Simulated database of users
users_db = {
    'user1': {'password_hash': bcrypt.hashpw(b'password123', bcrypt.gensalt()), 'failed_attempts': 0}
}

# Lockout duration in seconds
LOCKOUT_DURATION = 60 * 5  # 5 minutes

def check_login(username, password):
    if username not in users_db:
        return False, "User does not exist"

    user = users_db[username]
    if bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
        user['failed_attempts'] = 0
        return True, "Login successful"
    else:
        user['failed_attempts'] += 1
        if user['failed_attempts'] >= 3:
            lock_account(username)
        return False, "Invalid password"

def lock_account(username):
    users_db[username]['locked_until'] = secrets.token_hex(16)  # Simulate a timestamp

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    is_valid, message = check_login(username, password)
    if is_valid:
        return jsonify({"message": message}), 200
    else:
        return jsonify({"message": message}), 401

if __name__ == '__main__':
    app.run(debug=True)