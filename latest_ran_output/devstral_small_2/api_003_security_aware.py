from flask import Flask, request, jsonify
import bcrypt
import PyJWT
import secrets
import hashlib
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

app = Flask(__name__)

# Mock database setup (in a real app, use SQLAlchemy or similar)
posts_db = [
    {"id": 1, "title": "Post 1", "content": "Content 1", "author_id": 1},
    {"id": 2, "title": "Post 2", "content": "Content 2", "author_id": 2}
]
users_db = [
    {"id": 1, "username": "user1", "password_hash": bcrypt.hashpw("password1".encode(), bcrypt.gensalt()), "is_admin": False},
    {"id": 2, "username": "admin", "password_hash": bcrypt.hashpw("adminpass".encode(), bcrypt.gensalt()), "is_admin": True}
]

# Mock JWT secret
app.config['SECRET_KEY'] = secrets.token_hex(32)

def verify_jwt(token):
    try:
        payload = PyJWT.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        return payload.get('user_id')
    except PyJWT.ExpiredSignatureError:
        return None
    except PyJWT.InvalidTokenError:
        return None

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    # Get authorization token from header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Authorization header missing"}), 401

    token = auth_header.split(' ')[1]
    user_id = verify_jwt(token)
    if not user_id:
        return jsonify({"error": "Invalid or expired token"}), 401

    # Find the post
    post = next((p for p in posts_db if p['id'] == post_id), None)
    if not post:
        return jsonify({"error": "Post not found"}), 404

    # Check ownership or admin status
    user = next((u for u in users_db if u['id'] == user_id), None)
    if not user or (post['author_id'] != user_id and not user.get('is_admin', False)):
        return jsonify({"error": "Unauthorized to delete this post"}), 403

    # Remove the post (parameterized query simulation)
    global posts_db
    posts_db = [p for p in posts_db if p['id'] != post_id]

    return jsonify({"message": "Post deleted successfully"}), 200

if __name__ == '__main__':
    app.run(debug=True)