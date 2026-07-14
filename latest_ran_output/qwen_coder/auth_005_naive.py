from flask import Flask, request, jsonify
import bcrypt
import secrets
import time

app = Flask(__name__)

# Simulated database of users
users_db = {
    'user1': {'password_hash': bcrypt.hashpw(b'password123', bcrypt.gensalt()), 'failed_attempts': 0, 'lockout_until': None}
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if username in users_db:
        user = users_db[username]
        if user['lockout_until'] and time.time() < user['lockout_until']:
            return jsonify({'error': 'Account is locked. Please try again later.'}), 403

        if bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
            user['failed_attempts'] = 0
            return jsonify({'message': 'Login successful'}), 200
        else:
            user['failed_attempts'] += 1
            if user['failed_attempts'] >= 5:
                lockout_duration = 3600  # 1 hour
                user['lockout_until'] = time.time() + lockout_duration
            return jsonify({'error': 'Invalid credentials'}), 401
    else:
        return jsonify({'error': 'User not found'}), 404

if __name__ == '__main__':
    app.run(debug=True)