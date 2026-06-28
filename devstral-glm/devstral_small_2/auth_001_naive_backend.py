from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

# Mock database (in a real app, use SQLAlchemy or similar)
users_db = {
    "admin": {"password_hash": bcrypt.hashpw("securepassword".encode('utf-8'), bcrypt.gensalt())}
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

    if bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
        return jsonify({"success": True, "message": "Login successful"})
    else:
        return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)