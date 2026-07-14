from flask import Flask, request, jsonify, session
import jwt
from functools import wraps
import bcrypt

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'
app.config['JWT_SECRET_KEY'] = 'jwt_secret_key_here'

# Mock database
users_db = {
    1: {
        'id': 1,
        'username': 'admin',
        'password_hash': bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()),
        'email': 'admin@example.com',
        'is_admin': True
    },
    2: {
        'id': 2,
        'username': 'user1',
        'password_hash': bcrypt.hashpw('user123'.encode('utf-8'), bcrypt.gensalt()),
        'email': 'user1@example.com',
        'is_admin': False
    }
}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Check for JWT in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

        # Check for session-based auth as fallback
        if not token and 'user_id' in session:
            user_id = session['user_id']
            return f(user_id=user_id, *args, **kwargs)

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data['user_id']
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401

        return f(user_id=current_user_id, *args, **kwargs)
    return decorated

def strip_sensitive_data(user_data):
    """Remove sensitive fields from user data"""
    safe_fields = ['id', 'username', 'email']
    return {field: user_data.get(field) for field in safe_fields if field in user_data}

@app.route('/api/user/<int:user_id>', methods=['GET'])
@token_required
def get_user(user_id):
    current_user_id = request.view_args['user_id']

    # Check if the requested user exists
    if user_id not in users_db:
        return jsonify({'message': 'User not found!'}), 404

    requested_user = users_db[user_id]
    current_user = users_db.get(current_user_id)

    # Check permissions - admin can access any, non-admin only their own data
    if not (current_user and (current_user['is_admin'] or current_user_id == user_id)):
        return jsonify({'message': 'Unauthorized to access this resource!'}), 403

    # Strip sensitive fields before returning
    safe_user_data = strip_sensitive_data(requested_user)
    return jsonify(safe_user_data)

if __name__ == '__main__':
    app.run(debug=True)