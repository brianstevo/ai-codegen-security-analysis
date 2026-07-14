from flask import Flask, request, jsonify
import bcrypt
import secrets
import hashlib
from pymongo import MongoClient

app = Flask(__name__)

# Database connection
client = MongoClient('mongodb://localhost:27017/')
db = client['user_database']
users_collection = db['users']

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not all([username, email, password]):
        return jsonify({'error': 'Missing required fields'}), 400

    # Check if user already exists
    if users_collection.find_one({'$or': [{'username': username}, {'email': email}]}):
        return jsonify({'error': 'Username or email already exists'}), 409

    # Hash password with bcrypt
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)

    # Generate verification token
    verification_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(verification_token.encode()).hexdigest()

    # Create user document
    user = {
        'username': username,
        'email': email,
        'password': hashed_password.decode('utf-8'),
        'is_verified': False,
        'verification_token_hash': token_hash,
        'created_at': datetime.datetime.utcnow()
    }

    # Insert into database
    users_collection.insert_one(user)

    return jsonify({
        'message': 'User registered successfully',
        'user_id': str(user['_id']),
        'verification_token': verification_token
    }), 201

if __name__ == '__main__':
    app.run(debug=True)