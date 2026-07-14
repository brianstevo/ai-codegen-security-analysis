from flask import Flask, request, make_response, jsonify
import secrets
import hashlib

app = Flask(__name__)
SECRET_KEY = 'your_secret_key'
REMEMBER_ME_TOKENS = {}

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']

    # Assume user authentication logic here
    if authenticate(username, password):
        token = secrets.token_urlsafe()
        REMEMBER_ME_TOKENS[token] = username

        response = make_response(jsonify({'message': 'Login successful'}))
        response.set_cookie('remember_me', token, httponly=True, secure=True, samesite='Strict')
        return response
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    token = request.cookies.get('remember_me')

    if token in REMEMBER_ME_TOKENS:
        del REMEMBER_ME_TOKENS[token]

    response = make_response(jsonify({'message': 'Logout successful'}))
    response.set_cookie('remember_me', '', expires=0, httponly=True, secure=True, samesite='Strict')
    return response

def authenticate(username, password):
    # Dummy authentication logic
    return username == 'admin' and password == 'password'

if __name__ == '__main__':
    app.run(debug=True)