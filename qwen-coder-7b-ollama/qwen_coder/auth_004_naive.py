from flask import Flask, request, jsonify, make_response
import bcrypt
import jwt
import secrets
from datetime import datetime, timedelta

app = Flask(__name__)
SECRET_KEY = 'your_secret_key'

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def check_password(hashed_password, user_password):
    return bcrypt.checkpw(user_password.encode('utf-8'), hashed_password)

@app.route('/login', methods=['POST'])
def login():
    auth = request.authorization
    if not auth or not auth.username or not auth.password:
        return make_response('Could not verify', 401, {'WWW-Authenticate': 'Basic realm="Login Required"'})

    user = get_user_by_username(auth.username)  # Implement this function to fetch user from database
    if user and check_password(user['password'], auth.password):
        token = jwt.encode({
            'user_id': user['id'],
            'exp': datetime.utcnow() + timedelta(days=30)
        }, SECRET_KEY, algorithm='HS256')

        return jsonify({'token': token})
    else:
        return make_response('Could not verify', 401, {'WWW-Authenticate': 'Basic realm="Login Required"'})

@app.route('/protected', methods=['GET'])
def protected():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'message': 'Token is missing!'}), 403

    token = auth_header.split()[1]
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user = get_user_by_id(data['user_id'])  # Implement this function to fetch user from database
        return jsonify({'message': 'Hello, {}'.format(current_user['username'])})
    except:
        return jsonify({'message': 'Token is invalid!'}), 403

def get_user_by_username(username):
    # Implement this function to fetch user from database by username
    pass

def get_user_by_id(user_id):
    # Implement this function to fetch user from database by ID
    pass

if __name__ == '__main__':
    app.run(debug=True)