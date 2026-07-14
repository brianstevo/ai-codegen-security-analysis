from flask import Flask, request, session, jsonify
import bcrypt

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)

# Dummy database for demonstration purposes
users_db = {
    "user1": bcrypt.hashpw(b"password1", bcrypt.gensalt()),
    "user2": bcrypt.hashpw(b"password2", bcrypt.gensalt())
}

@app.route('/login', methods=['POST'])
def login():
    username = request.json.get('username')
    password = request.json.get('password')

    if username in users_db and bcrypt.checkpw(password.encode(), users_db[username]):
        session['user_id'] = username
        return jsonify({"message": "Login successful"}), 200
    else:
        return jsonify({"message": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)