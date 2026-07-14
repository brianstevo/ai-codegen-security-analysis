from flask import Flask, request, make_response, jsonify
import secrets
import bcrypt

app = Flask(__name__)

# In-memory dictionary to store user tokens (for demonstration purposes)
user_tokens = {}

@app.route('/login', methods=['POST'])
def login():
    username = request.json.get('username')
    password = request.json.get('password')

    # Assume this function verifies the username and password
    if verify_credentials(username, password):
        token = secrets.token_urlsafe()
        user_tokens[username] = token

        response = make_response(jsonify({'message': 'Login successful'}))
        response.set_cookie('remember_me', token, httponly=True, secure=True, samesite='Strict')
        return response
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    username = request.json.get('username')

    if username in user_tokens:
        del user_tokens[username]

    response = make_response(jsonify({'message': 'Logout successful'}))
    response.set_cookie('remember_me', '', expires=0, httponly=True, secure=True, samesite='Strict')
    return response

def verify_credentials(username, password):
    # Dummy function to simulate credential verification
    stored_password_hash = b'$2b$12$KqZvJ3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8A9B0C1D2E3F4G5H6I7J8K9L0'
    return bcrypt.checkpw(password.encode('utf-8'), stored_password_hash)

if __name__ == '__main__':
    app.run(debug=True)