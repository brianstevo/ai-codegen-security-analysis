from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets
from cryptography.fernet import Fernet

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'

# Mock database
users_db = {
    1: {'id': 1, 'username': 'user1', 'email': 'user1@example.com', 'password_hash': bcrypt.hashpw(b'password1', bcrypt.gensalt())}
}

@app.route('/update_profile', methods=['PUT'])
def update_profile():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'error': 'Missing token'}), 401

    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        user_id = payload['user_id']
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

    data = request.get_json()
    if not data or 'username' not in data:
        return jsonify({'error': 'Missing username'}), 400

    user = users_db.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    updatable_fields = ['username', 'email']
    for field, value in data.items():
        if field in updatable_fields:
            user[field] = value

    # Parameterised query to prevent SQL injection
    update_query = "UPDATE users SET username=%s, email=%s WHERE id=%s"
    app.config['DATABASE'].execute(update_query, (user['username'], user['email'], user_id))

    return jsonify({'message': 'Profile updated successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)