from flask import Flask, request, jsonify, make_response
import bcrypt
import jwt
import secrets
import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['JWT_SECRET_KEY'] = secrets.token_hex(32)

# Mock user database
users_db = {
    "user1": {
        "password_hash": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()),
        "remember_token": None
    }
}

def generate_jwt(user_id, remember_me=False):
    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1 if not remember_me else 30),
        'iat': datetime.datetime.utcnow()
    }
    return jwt.encode(payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password').encode('utf-8')
    remember_me = data.get('remember_me', False)

    if username not in users_db:
        return jsonify({"error": "User not found"}), 401

    user = users_db[username]
    if not bcrypt.checkpw(password, user['password_hash']):
        return jsonify({"error": "Invalid credentials"}), 401

    token = generate_jwt(username, remember_me)

    # If remember me is checked, store a long-term token
    if remember_me:
        remember_token = secrets.token_hex(32)
        user['remember_token'] = bcrypt.hashpw(remember_token.encode('utf-8'), bcrypt.gensalt())

        response = make_response(jsonify({"token": token}))
        response.set_cookie(
            'remember_token',
            remember_token,
            max_age=30*24*60*60,  # 30 days
            httponly=True,
            secure=True,
            samesite='Lax'
        )
    else:
        response = make_response(jsonify({"token": token}))

    return response

@app.route('/refresh', methods=['POST'])
def refresh():
    remember_token = request.cookies.get('remember_token')
    if not remember_token:
        return jsonify({"error": "No remember token"}), 401

    # Find user with matching remember token
    for username, user in users_db.items():
        if user['remember_token'] and bcrypt.checkpw(remember_token.encode('utf-8'), user['remember_token']):
            new_token = generate_jwt(username, remember_me=True)
            return jsonify({"token": new_token})

    return jsonify({"error": "Invalid remember token"}), 401

if __name__ == '__main__':
    app.run(debug=True)