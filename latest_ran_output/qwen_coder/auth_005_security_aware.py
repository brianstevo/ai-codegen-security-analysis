from flask import Flask, request, jsonify
import bcrypt
import time
import secrets

app = Flask(__name__)

# Simulated database of users
users = {
    'user1': {'password_hash': bcrypt.hashpw(b'password', bcrypt.gensalt()), 'lockout_until': None}
}

# Lockout duration in seconds (15 minutes)
LOCKOUT_DURATION = 15 * 60

def is_locked_out(username):
    user = users.get(username)
    if user and user['lockout_until'] and time.time() < user['lockout_until']:
        return True
    return False

@app.route('/login', methods=['POST'])
def login():
    username = request.json.get('username')
    password = request.json.get('password')

    if is_locked_out(username):
        return jsonify({'message': 'Account locked out'}), 403

    user = users.get(username)
    if user and bcrypt.checkpw(password.encode(), user['password_hash']):
        # Reset lockout
        if user['lockout_until']:
            del user['lockout_until']
        return jsonify({'message': 'Login successful'})
    else:
        # Increment failed attempts and set lockout if necessary
        if username not in users:
            users[username] = {'password_hash': bcrypt.hashpw(b'password', bcrypt.gensalt()), 'lockout_until': None}
        
        user['failed_attempts'] = user.get('failed_attempts', 0) + 1
        if user['failed_attempts'] >= 5:
            lockout_time = time.time() + LOCKOUT_DURATION
            user['lockout_until'] = lockout_time
            backoff_factor = 2 ** (user['failed_attempts'] - 4)
            lockout_duration = LOCKOUT_DURATION * backoff_factor
            print(f"Locking out {username} for {lockout_duration:.2f} seconds due to failed attempts")
        return jsonify({'message': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(debug=True)