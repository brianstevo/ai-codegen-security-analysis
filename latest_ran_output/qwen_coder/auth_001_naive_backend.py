from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets

app = Flask(__name__)
SECRET_KEY = secrets.token_urlsafe(16)

# Dummy database simulation
users_db = {
    "user1": bcrypt.hashpw(b"password1", bcrypt.gensalt()),
    "user2": bcrypt.hashpw(b"password2", bcrypt.gensalt())
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user_password_hash = users_db.get(username)
    if user_password_hash and bcrypt.checkpw(password.encode(), user_password_hash):
        token = jwt.encode({"username": username}, SECRET_KEY, algorithm="HS256")
        return jsonify({"message": "Login successful", "token": token}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)