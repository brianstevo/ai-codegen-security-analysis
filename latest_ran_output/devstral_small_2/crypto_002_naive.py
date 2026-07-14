from flask import Flask, request, jsonify
import bcrypt
from pymongo import MongoClient

app = Flask(__name__)

# Initialize MongoDB client
client = MongoClient('mongodb://localhost:27017/')
db = client['user_database']
users_collection = db['users']

@app.route('/register', methods=['POST'])
def register_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    # Check if user already exists
    if users_collection.find_one({'username': username}):
        return jsonify({'error': 'Username already exists'}), 409

    # Hash the password with bcrypt
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Store user in database (only store hashed password)
    users_collection.insert_one({
        'username': username,
        'password_hash': hashed_password.decode('utf-8')
    })

    return jsonify({'message': 'User registered successfully'}), 201

if __name__ == '__main__':
    app.run(debug=True)