```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import jwt
from functools import wraps
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
DATABASE = 'posts.db'

def get_db_connection():
    """Get a database connection with row factory for dict-like access."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database with tables."""
    conn = get_db_connection()
    c = conn.cursor()
    
    # Create users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create posts table
    c.execute('''
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    conn.commit()
    conn.close()

def verify_token(f):
    """Decorator to verify JWT token and extract user information."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Invalid authorization header format'}), 401
        
        if not token:
            return jsonify({'error': 'Missing authorization token'}), 401
        
        try:
            # Decode the JWT token
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            request.user_id = data['user_id']
            request.is_admin = data.get('is_admin', False)
            request.username = data.get('username', '')
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function

@app.route('/delete_post/<int:post_id>', methods=['DELETE'])
@verify_token
def delete_post(post_id):
    """
    Delete a post if the authenticated user owns it or is an admin.
    
    Args:
        post_id: The ID of the post to delete
        
    Returns:
        JSON response with success/error message
        403 if user is not authorized
        404 if post not found
        200 if deletion successful
    """
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Get the post to verify ownership
        c.execute('SELECT user_id FROM posts WHERE id = ?', (post_id,))
        post = c.fetchone()
        
        if not post:
            conn.close()
            return jsonify({'error': 'Post not found'}), 404
        
        post_user_id = post['user_id']
        
        # Check if user is the post owner or is an admin
        is_owner = post_user_id == request.user_id
        is_admin = request.is_admin
        
        if not (is_owner or is_admin):
            conn.close()
            return jsonify({'error': 'Unauthorized to delete this post'}), 403
        
        # Delete the post using parameterized query
        c.execute('DELETE FROM posts WHERE id = ?', (post_id,))
        conn.commit()
        
        # Verify deletion was successful
        if c.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Failed to delete post'}), 500
        
        conn.close()
        
        return jsonify({
            'message': 'Post deleted successfully',
            'post_id': post_id
        }), 200
        
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/posts', methods=['POST'])
@verify_token
def create_post():
    """Create a new post (for testing purposes)."""
    data = request.get_json()
    
    if not data or 'title' not in data or 'content' not in data:
        return jsonify({'error': 'Missing title or content'}), 400
    
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute(
            'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)',
            (request.user_id, data['title'], data['content'])
        )
        conn.commit()
        
        post_id = c.lastrowid
        conn.close()
        
        return jsonify({
            'message': 'Post created successfully',
            'post_id': post_id
        }), 201
        
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/users', methods=['POST'])
def create_user():
    """Create a new user (for testing purposes)."""
    data = request.get_json()
    
    if not data or 'username' not in data or 'email' not in data or 'password' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # For simplicity, store password as-is (in production, use proper hashing)
        c.execute(
            'INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
            (data['username'], data['email'], data['password'], data.get('is_admin', 0))
        )
        conn.commit()
        
        user_id = c.lastrowid
        conn.close()
        
        return jsonify({
            'message': 'User created successfully',
            'user_id': user_id
        }), 201
        
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 409
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/login', methods=['POST'])
def login():
    """Login a user and return JWT token (for testing purposes)."""
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing username or password'}), 400
    
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute('SELECT id, is_admin FROM users WHERE username = ? AND password_hash = ?',
                  (data['username'], data['password']))
        user = c.fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create JWT token
        token = jwt.encode({
            'user_id': user['id'],
            'username': data['username'],
            'is_admin': user['is_admin']
        }, SECRET_KEY, algorithm='HS256')
        
        return jsonify({
            'message': 'Login successful',