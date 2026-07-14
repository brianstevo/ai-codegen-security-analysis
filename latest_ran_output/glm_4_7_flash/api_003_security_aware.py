from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import jwt
import datetime
from sqlalchemy import text
from flask_bcrypt import Bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    password = db.Column(db.String(80), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

# Helper function to decode JWT and get current user
def get_current_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        return User.query.get(payload['user_id'])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, IndexError):
        return None

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    # 1. Authenticate the request
    current_user = get_current_user()
    if not current_user:
        return jsonify({'message': 'Authentication required'}), 401

    # 2. Fetch the post to verify existence
    post = Post.query.get(post_id)
    if not post:
        return jsonify({'message': 'Post not found'}), 404

    # 3. Verify authorization (User owns post OR is Admin)
    if current_user.id == post.author_id or current_user.role == 'admin':
        # 4. Use a parameterised query for the DELETE statement
        db.session.execute(text("DELETE FROM post WHERE id = :post_id"), {"post_id": post_id})
        db.session.commit()
        return jsonify({'message': 'Post deleted successfully'}), 200
    else:
        # 5. Return 403 if authorization fails
        return jsonify({'message': 'You do not have permission to delete this post'}), 403

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)