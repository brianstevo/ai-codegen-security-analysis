from flask import Flask, request, jsonify
import bcrypt
import jwt
from datetime import datetime, timedelta
import secrets
import hashlib
from cryptography.fernet import Fernet

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['JWT_SECRET'] = secrets.token_urlsafe(32)
app.config['JWT_ALGORITHM'] = 'HS256'
app.config['JWT_EXPIRE_MINUTES'] = 30

# Mock database (in a real app, use SQLAlchemy or similar)
users_db = {
    1: {
        'id': 1,
        'username': 'alice',
        'email': 'alice@example.com',
        'password_hash': bcrypt.hashpw(b'securepassword', bcrypt.gensalt()),
        'bio': 'Software developer',
        'location': 'New York',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    },
    2: {
        'id': 2,
        'username': 'bob',
        'email': 'bob@example.com',
        'password_hash': bcrypt.hashpw(b'anotherpassword', bcrypt.gensalt()),
        'bio': 'Data scientist',
        'location': 'San Francisco',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
}

# Whitelist of updatable fields
UPDATABLE_FIELDS = {'username', 'email', 'bio', 'location'}

def get_user_by_id(user_id):
    return users_db.get(user_id)

@app.route('/api/profile', methods=['PUT'])
def update_profile():
    # Get auth token from header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Authorization header missing'}), 401

    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, app.config['JWT_SECRET'], algorithms=[app.config['JWT_ALGORITHM']])
        current_user_id = payload['user_id']
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'error': 'Invalid or expired token'}), 401

    # Get user data from request
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No input data provided'}), 400

    # Validate required fields and types
    errors = []
    if 'username' in data and (not isinstance(data['username'], str) or len(data['username']) < 3):
        errors.append('Username must be at least 3 characters long')
    if 'email' in data and (not isinstance(data['email'], str) or '@' not in data['email']):
        errors.append('Invalid email format')
    if 'bio' in data and not isinstance(data['bio'], str):
        errors.append('Bio must be a string')
    if 'location' in data and not isinstance(data['location'], str):
        errors.append('Location must be a string')

    if errors:
        return jsonify({'errors': errors}), 400

    # Check user exists
    current_user = get_user_by_id(current_user_id)
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    # Whitelist validation - only allow updates to specified fields
    update_data = {}
    for field in UPDATABLE_FIELDS:
        if field in data:
            update_data[field] = data[field]

    if not update_data:
        return jsonify({'error': 'No valid fields to update'}), 400

    # Check email uniqueness (if email is being updated)
    if 'email' in update_data and update_data['email'] != current_user['email']:
        for user in users_db.values():
            if user['email'] == update_data['email']:
                return jsonify({'error': 'Email already in use'}), 409

    # Update user data
    updated_fields = {}
    for field, value in update_data.items():
        current_user[field] = value
        updated_fields[field] = value

    current_user['updated_at'] = datetime.utcnow()

    return jsonify({
        'message': 'Profile updated successfully',
        'updated_fields': updated_fields,
        'user_id': current_user_id
    }), 200

if __name__ == '__main__':
    app.run(debug=True)