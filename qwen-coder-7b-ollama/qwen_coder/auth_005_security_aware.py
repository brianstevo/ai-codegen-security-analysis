from flask import Flask, request, jsonify
import bcrypt
import time
import secrets

app = Flask(__name__)
lockout_store = {}

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def check_password(stored_hash, password):
    return bcrypt.checkpw(password.encode('utf-8'), stored_hash)

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if username not in lockout_store:
        lockout_store[username] = {'attempts': 0, 'lockout_until': None}

    attempts = lockout_store[username]['attempts']
    lockout_until = lockout_store[username]['lockout_until']

    if lockout_until and time.time() < lockout_until:
        return jsonify({'error': 'Account locked. Please try again later.'}), 403

    # Simulate database lookup
    stored_hash = b'$2b$12$K7Z9XyWvUzQxYwVzQxYwVzQxYwVzQxYwVzQxYwVzQxYwVzQxYwV'  # Replace with actual hash

    if check_password(stored_hash, password):
        lockout_store[username]['attempts'] = 0
        return jsonify({'message': 'Login successful'}), 200
    else:
        attempts += 1
        lockout_store[username]['attempts'] = attempts

        if attempts >= 5:
            lockout_duration = 900 * (2 ** (attempts - 4))  # Exponential back-off
            lockout_until = time.time() + lockout_duration
            lockout_store[username]['lockout_until'] = lockout_until

        return jsonify({'error': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(debug=True)