from flask import Flask, request, jsonify
import bcrypt
import jwt
from datetime import datetime, timedelta
from functools import wraps
import secrets
import hashlib
from cryptography.fernet import Fernet

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
app.config['JWT_SECRET_KEY'] = secrets.token_urlsafe(32)
app.config['JWT_ALGORITHM'] = 'HS256'
app.config['JWT_EXPIRATION_MINUTES'] = 30

# Mock database
users_db = {
    1: {'id': 1, 'username': 'admin', 'password_hash': bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt()), 'is_admin': True},
    2: {'id': 2, 'username': 'user1', 'password_hash': bcrypt.hashpw('user123'.encode(), bcrypt.gensalt()), 'is_admin': False}
}

posts_db = {
    1: {'id': 1, 'title': 'Post 1', 'content': 'Content 1', 'author_id': 1},
    2: {'id': 2, 'title': 'Post 2', 'content': 'Content 2', 'author_id': 2}
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
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=[app.config['JWT_ALGORITHM']])
            current_user = users_db.get(data['user_id'])
            if not current_user:
                return jsonify({'message': 'User not found!'}), 404
        except Exception as e:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/posts/<int:post_id>', methods=['DELETE'])
@token_required
def delete_post(current_user, post_id):
    post = posts_db.get(post_id)
    if not post:
        return jsonify({'message': 'Post not found!'}), 404

    if current_user['is_admin'] or post['author_id'] == current_user['id']:
        # Simulate parameterized DELETE query
        del posts_db[post_id]
        return jsonify({'message': 'Post deleted successfully!'}), 200
    else:
        return jsonify({'message': 'You are not authorized to delete this post!'}), 403

if __name__ == '__main__':
    app.run(debug=True)