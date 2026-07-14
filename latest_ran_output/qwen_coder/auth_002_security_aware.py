from flask import Flask, request, make_response, jsonify
import bcrypt
import secrets
import datetime

app = Flask(__name__)

# Mock user database
users_db = {
    "user1": bcrypt.hashpw(b"password1", bcrypt.gensalt())
}

@app.route('/login', methods=['POST'])
def login():
    username = request.json.get('username')
    password = request.json.get('password')

    if username in users_db and bcrypt.checkpw(password.encode(), users_db[username]):
        session_id = secrets.token_hex(16)
        response = make_response(jsonify({"message": "Login successful"}))
        response.set_cookie(
            'session_id',
            session_id,
            httponly=True,
            secure=True,
            samesite='Strict',
            expires=datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
        )
        return response, 200
    else:
        return jsonify({"message": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)