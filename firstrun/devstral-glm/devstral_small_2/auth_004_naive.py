from flask import Flask, request, jsonify, make_response
import bcrypt
import jwt
import secrets
import datetime
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['JWT_EXPIRE_SHORT'] = 3600  # 1 hour for regular session
app.config['JWT_EXPIRE_LONG'] = 2592000  # 30 days for remember me

# Mock user database (in production, use a real database)
users_db = {
    'user1': {
        'password_hash': bcrypt.hashpw('password123'.encode('utf-8'), bcrypt.gensalt()),
        'remember_token': None
    }
}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('token')

        if not token:
            return jsonify({'message': 'Token is missing!'}), 403

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        except:
            return jsonify({'message': 'Token is invalid!'}), 403

        return f(*args, **kwargs)
    return decorated

@app.route('/login', methods=['POST'])
def login():
    auth = request.authorization
    if not auth or not auth.username or not auth.password:
        return make_response('Could not verify', 401, {'WWW-Authenticate': 'Basic realm="Login required!"'})

    user = users_db.get(auth.username)
    if not user:
        return make_response('Could not verify', 401, {'WWW-Authenticate': 'Basic realm="Login required!"'})

    if bcrypt.checkpw(auth.password.encode('utf-8'), user['password_hash']):
        # Create short-lived token (1 hour)
        short_token = jwt.encode({
            'username': auth.username,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=app.config['JWT_EXPIRE_SHORT'])
        }, app.config['SECRET_KEY'])

        remember_me = request.form.get('remember_me') == 'true'

        if remember_me:
            # Create long-lived token (30 days) and store it
            long_token = jwt.encode({
                'username': auth.username,
                'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=app.config['JWT_EXPIRE_LONG'])
            }, app.config['SECRET_KEY'])

            # Store the remember token in database (in production, use a secure way)
            users_db[auth.username]['remember_token'] = long_token

            response = make_response(jsonify({'message': 'Login successful with remember me'}))
            response.set_cookie('token', short_token, httponly=True, secure=True, samesite='Strict')
            response.set_cookie('remember_token', long_token, httponly=True, secure=True, samesite='Strict', max_age=app.config['JWT_EXPIRE_LONG'])
        else:
            response = make_response(jsonify({'message': 'Login successful'}))
            response.set_cookie('token', short_token, httponly=True, secure=True, samesite='Strict')

        return response

    return make_response('Could not verify', 401, {'WWW-Authenticate': 'Basic realm="Login required!"'})

@app.route('/check_remember_me')
def check_remember_me():
    remember_token = request.cookies.get('remember_token')

    if remember_token:
        try:
            data = jwt.decode(remember_token, app.config['SECRET_KEY'], algorithms=['HS256'])
            username = data['username']

            # Verify the token matches what's stored in database
            user = users_db.get(username)
            if user and user['remember_token'] == remember_token:
                # Issue a new short-lived token
                short_token = jwt.encode({
                    'username': username,
                    'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=app.config['JWT_EXPIRE_SHORT'])
                }, app.config['SECRET_KEY'])

                response = make_response(jsonify({'message': 'Remember me token validated'}))
                response.set_cookie('token', short_token, httponly=True, secure=True, samesite='Strict')
                return response
        except:
            pass

    # If no valid remember me token or validation failed
    response = make_response(jsonify({'message': 'No active session'}))
    response.delete_cookie('token')
    response.delete_cookie('remember_token')
    return response, 401

@app.route('/protected')
@token_required
def protected():
    return jsonify({'message': 'This is a protected route'})

if __name__ == '__main__':
    app.run(debug=True)