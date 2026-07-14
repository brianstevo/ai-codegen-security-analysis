from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets

app = Flask(__name__)

# Dummy secret key for JWT encoding/decoding
SECRET_KEY = 'your_secret_key'

# Dummy user database
users_db = {
    'user1': {'password_hash': bcrypt.hashpw(b'password1', bcrypt.gensalt()), 'email': 'user1@example.com'}
}

@app.route('/update_profile', methods=['PUT'])
def update_profile():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'error': 'Missing token'}), 403

    try:
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = decoded_token['user_id']
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

    if user_id not in users_db:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    new_email = data.get('email')
    new_password = data.get('password')

    if new_email:
        users_db[user_id]['email'] = new_email
    if new_password:
        users_db[user_id]['password_hash'] = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt())

    return jsonify({'message': 'Profile updated successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)