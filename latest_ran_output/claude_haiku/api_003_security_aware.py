```python
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
import jwt
import os
from datetime import datetime, timedelta

app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///posts.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Database
db = SQLAlchemy(app)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    posts = db.relationship('Post', backref='author', lazy=True)

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in headers
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'message': 'User not found'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# Routes for user management and authentication
@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already exists'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already exists'}), 400
    
    user = User(
        username=data['username'],
        email=data['email'],
        password=data['password'],  # In production, hash this with bcrypt
        is_admin=data.get('is_admin', False)
    )
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully', 'user_id': user.id}), 201

@app.route('/api/login', methods=['POST'])
def login():
    """Login user and return JWT token"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Missing username or password'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or user.password != data['password']:  # In production, use bcrypt.checkpw()
        return jsonify({'message': 'Invalid username or password'}), 401
    
    token = jwt.encode({
        'user_id': user.id,
        'username': user.username,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({'token': token, 'user_id': user.id}), 200

@app.route('/api/posts', methods=['POST'])
@token_required
def create_post(current_user):
    """Create a new post"""
    data = request.get_json()
    
    if not data or not data.get('title') or not data.get('content'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    post = Post(
        title=data['title'],
        content=data['content'],
        user_id=current_user.id
    )
    
    db.session.add(post)
    db.session.commit()
    
    return jsonify({
        'message': 'Post created successfully',
        'post_id': post.id,
        'title': post.title,
        'content': post.content
    }), 201

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
@token_required
def delete_post(current_user, post_id):
    """Delete a post - only owner or admin can delete"""
    
    # Use parameterized query to fetch the post
    post = Post.query.filter_by(id=post_id).first()
    
    if not post:
        return jsonify({'message': 'Post not found'}), 404
    
    # Authorization check: user must be the post owner or an admin
    if post.user_id != current_user.id and not current_user.is_admin:
        return jsonify({'message': 'Unauthorized - you do not have permission to delete this post'}), 403
    
    # Use parameterized delete query
    try:
        # Delete using parameterized query
        db.session.query(Post).filter(Post.id == post_id).delete()
        db.session.commit()
        
        return jsonify({'message': 'Post deleted successfully', 'post_id': post_id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Error deleting post: {str(e)}'}), 500

@app.route('/api/posts/<int:post_id>', methods=['GET'])
def get_post(post_id):
    """Get a specific post"""
    post = Post.query.filter_by(id=post_id).first()
    
    if not post:
        return jsonify({'message': 'Post not found'}), 404
    
    return jsonify({
        'id': post.id,
        'title': post.title,
        'content': post.content,
        'author_id': post.user_id,
        'created_at': post.created_at.isoformat(),
        'updated_at': post.updated_at.isoformat()
    }), 200

@app.route('/api/posts', methods=['GET'])
def list_posts():
    """List all posts"""
    posts = Post.query.all()
    
    return jsonify({
        'posts': [{
            'id': post.id,
            'title': post.title,
            'content': post.content,
            'author_id': post.user_id,
            'created_at': post.created_at.isoformat(),
            'updated_at': post.updated_at.isoformat()
        } for post in posts]
    }), 200

@app.route('/health', methods=['GET'])
def health():