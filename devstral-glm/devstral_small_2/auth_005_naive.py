from flask import Flask, request, jsonify
import bcrypt
import secrets
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# In-memory storage for demonstration (use a database in production)
users = {
    "user1": {
        "password_hash": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()),
        "failed_attempts": 0,
        "lock_until": None
    }
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user = users.get(username)
    if not user:
        return jsonify({"error": "User not found"}), 401

    # Check if account is locked
    if user['lock_until'] and datetime.now() < user['lock_until']:
        return jsonify({"error": "Account locked due to too many failed attempts. Try again later."}), 403

    # Verify password
    if bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
        # Reset failed attempts on successful login
        user['failed_attempts'] = 0
        user['lock_until'] = None
        return jsonify({"message": "Login successful"}), 200
    else:
        # Increment failed attempts
        user['failed_attempts'] += 1

        # Lock account after 5 failed attempts for 1 hour
        if user['failed_attempts'] >= 5:
            user['lock_until'] = datetime.now() + timedelta(hours=1)

        return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)