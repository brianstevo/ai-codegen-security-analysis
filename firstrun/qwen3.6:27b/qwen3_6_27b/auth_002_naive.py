from flask import Flask, request, jsonify, session
import bcrypt

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # In production, use a secure random key

# Mock database for demonstration purposes
users_db = {
    "admin": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    stored_hash = users_db.get(username)
    if not stored_hash:
        return jsonify({"error": "Invalid credentials"}), 401

    # Verify password
    if bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
        # Create session and store user ID (using username as ID for this example)
        session['user_id'] = username
        return jsonify({"message": "Login successful", "user_id": username}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)