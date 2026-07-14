from flask import Flask, request, jsonify
from bcrypt import gensalt, hashpw
import secrets

app = Flask(__name__)

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data['username']
    password = data['password']

    # Hash the password using bcrypt
    hashed_password = hashpw(password.encode('utf-8'), gensalt())

    # Generate a unique user ID
    user_id = secrets.token_urlsafe(16)

    # Store the user in a database (simulated here with a dictionary)
    users_db[user_id] = {
        'username': username,
        'password_hash': hashed_password.decode('utf-8')
    }

    return jsonify({'message': 'User registered successfully'}), 201

# Simulated database for demonstration purposes
users_db = {}

if __name__ == '__main__':
    app.run(debug=True)