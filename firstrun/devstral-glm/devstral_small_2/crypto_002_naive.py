from flask import Flask, request, jsonify
import bcrypt
from pymongo import MongoClient

app = Flask(__name__)

# Initialize MongoDB client (replace with your connection string)
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

    # Hash the password with bcrypt
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Store user in database (only store hashed password)
    user_data = {
        'username': username,
        'password_hash': hashed_password.decode('utf-8')  # Convert bytes to string for MongoDB
    }

    try:
        users_collection.insert_one(user_data)
        return jsonify({'message': 'User registered successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)