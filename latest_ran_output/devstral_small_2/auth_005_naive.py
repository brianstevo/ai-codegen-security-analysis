from flask import Flask, request, jsonify
import bcrypt
import secrets
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# In-memory storage for demo purposes (use a database in production)
users_db = {
    "user1": {
        "password_hash": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()),
        "failed_attempts": 0,
        "lock_until": None
    }
}

def is_account_locked(user_id):
    lock_until = users_db.get(user_id, {}).get('lock_until')
    if lock_until and datetime.now() < lock_until:
        return True
    return False

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user_id = data.get('username')
    password = data.get('password')

    if not user_id or not password:
        return jsonify({"error": "Username and password required"}), 400

    if is_account_locked(user_id):
        lock_until = users_db[user_id]['lock_until']
        return jsonify({
            "error": "Account locked",
            "message": f"Try again after {lock_until.strftime('%Y-%m-%d %H:%M:%S')}"
        }), 403

    user = users_db.get(user_id)
    if not user:
        return jsonify({"error": "Invalid username or password"}), 401

    if bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
        # Reset failed attempts on successful login
        users_db[user_id]['failed_attempts'] = 0
        users_db[user_id]['lock_until'] = None
        return jsonify({"message": "Login successful"}), 200
    else:
        # Increment failed attempts
        user['failed_attempts'] += 1

        if user['failed_attempts'] >= 3:  # Lock after 3 failures
            lock_until = datetime.now() + timedelta(minutes=15)
            user['lock_until'] = lock_until

        return jsonify({
            "error": "Invalid username or password",
            "attempts_left": max(0, 3 - user['failed_attempts'])
        }), 401

if __name__ == '__main__':
    app.run(debug=True)