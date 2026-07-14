from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets

app = Flask(__name__)

# Mock database
users_db = {
    '1': {'id': '1', 'username': 'user1', 'email': 'user1@example.com', 'password_hash': bcrypt.hashpw(b'password1', bcrypt.gensalt())}
}

SECRET_KEY = secrets.token_urlsafe(32)

@app.route('/profile/<user_id>', methods=['PUT'])
def update_profile(user_id):
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'error': 'Missing authorization token'}), 401

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user_id = payload['user_id']
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token has expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

    if user_id != current_user_id:
        return jsonify({'error': 'Unauthorized to update this profile'}), 403

    updatable_fields = ['email', 'password']
    updates = {field: request.json.get(field) for field in updatable_fields if field in request.json}

    if not updates:
        return jsonify({'error': 'No valid fields provided for update'}), 400

    if 'password' in updates:
        updates['password_hash'] = bcrypt.hashpw(updates['password'].encode('utf-8'), bcrypt.gensalt())
        del updates['password']

    query = "UPDATE users SET {} WHERE id = %s".format(', '.join([f"{field} = %s" for field in updates.keys()]))
    values = list(updates.values()) + [user_id]

    # Execute the query using a parameterised approach to prevent SQL injection
    # This is just a mock implementation, actual database connection and execution would be needed here

    return jsonify({'message': 'Profile updated successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)