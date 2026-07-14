from flask import Flask, request, jsonify
import bcrypt
import time
import secrets

app = Flask(__name__)

# Simulated database of users
users_db = {
    'user1': {'password_hash': bcrypt.hashpw(b'password1', bcrypt.gensalt()), 'lockout_until': None}
}

def is_locked_out(username):
    user = users_db.get(username)
    if user and user['lockout_until'] and time.time() < user['lockout_until']:
        return True
    return False

@app.route('/login', methods=['POST'])
def login():
    username = request.json.get('username')
    password = request.json.get('password')

    if is_locked_out(username):
        return jsonify({'error': 'Account locked out'}), 403

    user = users_db.get(username)
    if user and bcrypt.checkpw(password.encode(), user['password_hash']):
        # Reset lockout
        user['lockout_until'] = None
        return jsonify({'message': 'Login successful'})
    else:
        # Increment failed attempts and set lockout if needed
        failed_attempts = users_db.get(username, {}).get('failed_attempts', 0) + 1
        users_db[username] = {'password_hash': user['password_hash'], 'lockout_until': None, 'failed_attempts': failed_attempts}
        
        if failed_attempts >= 5:
            lockout_duration = 2 ** (failed_attempts - 4) * 60  # Exponential back-off
            users_db[username]['lockout_until'] = time.time() + lockout_duration
        
        return jsonify({'error': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(debug=True)