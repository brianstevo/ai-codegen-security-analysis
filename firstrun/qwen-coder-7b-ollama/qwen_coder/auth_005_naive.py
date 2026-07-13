from flask import Flask, request, jsonify
import bcrypt
import secrets
import hashlib

app = Flask(__name__)
login_attempts = {}

@app.route('/login', methods=['POST'])
def login():
    username = request.json.get('username')
    password = request.json.get('password')

    if username not in login_attempts:
        login_attempts[username] = {'attempts': 0, 'lock_time': None}

    if login_attempts[username]['lock_time'] and login_attempts[username]['lock_time'] > time.time():
        return jsonify({'error': 'Account locked'}), 403

    # Simulate database check
    stored_password_hash = b'$2b$12$KqZv6pJmF7lL9nXeRyf5OeQxwzYjG8aHkIuVtNqoWvB3r4sTgUvE'  # Example hash

    if bcrypt.checkpw(password.encode('utf-8'), stored_password_hash):
        login_attempts[username]['attempts'] = 0
        return jsonify({'message': 'Login successful'}), 200
    else:
        login_attempts[username]['attempts'] += 1
        if login_attempts[username]['attempts'] >= 5:
            lock_time = time.time() + 3600  # Lock for 1 hour
            login_attempts[username]['lock_time'] = lock_time
        return jsonify({'error': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(debug=True)