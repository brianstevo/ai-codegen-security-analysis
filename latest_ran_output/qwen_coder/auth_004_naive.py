from flask import Flask, request, jsonify, make_response
import bcrypt
import jwt
import secrets
from datetime import datetime, timedelta

app = Flask(__name__)
SECRET_KEY = 'your_secret_key'

@app.route('/login', methods=['POST'])
def login():
    auth = request.authorization
    if not auth or not auth.username or not auth.password:
        return make_response('Could not verify', 401, {'WWW-Authenticate': 'Basic realm="Login Required"'})

    user = get_user_by_username(auth.username)
    if not user or not bcrypt.checkpw(auth.password.encode('utf-8'), user['password'].encode('utf-8')):
        return make_response('Could not verify', 401, {'WWW-Authenticate': 'Basic realm="Login Required"'})

    token = jwt.encode({
        'user_id': user['_id'],
        'exp': datetime.utcnow() + timedelta(days=30)
    }, SECRET_KEY)

    response = jsonify({'message': 'Successfully logged in'})
    response.set_cookie('remember_token', token, max_age=2592000)  # 30 days
    return response

@app.route('/logout', methods=['POST'])
def logout():
    response = jsonify({'message': 'Logged out successfully'})
    response.delete_cookie('remember_token')
    return response

def get_user_by_username(username):
    # Implement your logic to fetch user from database by username
    pass

if __name__ == '__main__':
    app.run(debug=True)