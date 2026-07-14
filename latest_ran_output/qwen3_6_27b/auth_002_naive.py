from flask import Flask, request, jsonify, session
import bcrypt

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # In production, use a secure random key

# Mock database for demonstration purposes
users_db = {
    "user1": {
        "password_hash": bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode('utf-8'),
        "user_id": 1
    },
    "user2": {
        "password_hash": bcrypt.hashpw(b"securepass", bcrypt.gensalt()).decode('utf-8'),
        "user_id": 2
    }
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = users_db.get(username)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # Verify password using bcrypt
    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({"error": "Invalid credentials"}), 401

    # Create session and store user ID
    session['user_id'] = user['user_id']
    session.permanent = True  # Optional: make session permanent if needed

    return jsonify({"message": "Login successful", "user_id": user['user_id']}), 200

if __name__ == '__main__':
    app.run(debug=True)