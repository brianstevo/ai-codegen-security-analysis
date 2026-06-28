from flask import Flask, request, jsonify, session
import jwt
import bcrypt
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-key-here'

# Mock database
users_db = {
    1: {'id': 1, 'username': 'admin', 'password': bcrypt.hashpw('adminpass'.encode(), bcrypt.gensalt()), 'is_admin': True},
    2: {'id': 2, 'username': 'user1', 'password': bcrypt.hashpw('user1pass'.encode(), bcrypt.gensalt()), 'is_admin': False}
}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split()[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
        except Exception as e:
            return jsonify({'message': 'Token is invalid!'}), 401

        return f(current_user_id, *args, **kwargs)
    return decorated

def strip_sensitive_data(user_data):
    sensitive_fields = ['password', 'is_admin'] if not user_data.get('is_admin') else []
    for field in sensitive_fields:
        user_data.pop(field, None)
    return user_data

@app.route('/api/user/<int:user_id>', methods=['GET'])
@token_required
def get_user(current_user_id, user_id):
    target_user = users_db.get(user_id)

    if not target_user:
        return jsonify({'message': 'User not found!'}), 404

    # Check if current user is admin or accessing their own data
    if current_user_id != user_id and not users_db[current_user_id]['is_admin']:
        return jsonify({'message': 'Unauthorized access!'}), 403

    user_data = target_user.copy()
    stripped_data = strip_sensitive_data(user_data)

    return jsonify(stripped_data), 200

if __name__ == '__main__':
    app.run(debug=True)