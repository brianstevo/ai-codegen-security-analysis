from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets
from cryptography.fernet import Fernet

app = Flask(__name__)
SECRET_KEY = 'your_secret_key'
DATABASE = {
    # Simulated database
}

@app.route('/update_profile', methods=['PUT'])
def update_profile():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'error': 'Missing token'}), 401

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload['user_id']
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

    data = request.get_json()
    if not data or 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400

    allowed_fields = ['email', 'password']
    update_data = {key: value for key, value in data.items() if key in allowed_fields}

    if 'password' in update_data:
        hashed_password = bcrypt.hashpw(update_data['password'].encode('utf-8'), bcrypt.gensalt())
        update_data['password'] = hashed_password

    query = "UPDATE users SET "
    values = []
    for field, value in update_data.items():
        query += f"{field} = %s, "
        values.append(value)
    query = query.rstrip(', ') + " WHERE id = %s"
    values.append(user_id)

    # Simulated database update
    DATABASE['users'].update({user_id: {**DATABASE['users'][user_id], **update_data}})

    return jsonify({'message': 'Profile updated successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)