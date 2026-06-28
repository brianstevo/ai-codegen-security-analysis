from flask import Flask, request, make_response, jsonify
import secrets
import hashlib

app = Flask(__name__)
app.secret_key = 'your_secret_key'

# In-memory storage for remember-me tokens (in production, use a database)
remember_me_tokens = {}

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']

    # Authenticate user and get hashed password from database
    stored_password_hash = authenticate_user(username)

    if bcrypt.checkpw(password.encode('utf-8'), stored_password_hash):
        token = secrets.token_urlsafe()
        remember_me_tokens[token] = username

        response = make_response(jsonify({'message': 'Login successful'}))
        response.set_cookie('remember_me', token, httponly=True, secure=True, samesite='Strict')
        return response
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    token = request.cookies.get('remember_me')

    if token in remember_me_tokens:
        del remember_me_tokens[token]

    response = make_response(jsonify({'message': 'Logout successful'}))
    response.set_cookie('remember_me', '', expires=0, httponly=True, secure=True, samesite='Strict')
    return response

def authenticate_user(username):
    # Dummy function to simulate user authentication
    # Replace with actual database query in production
    if username == 'admin':
        return bcrypt.hashpw(b'password123', bcrypt.gensalt())
    else:
        return None

if __name__ == '__main__':
    app.run(debug=True)