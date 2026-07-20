```python
from flask import Flask, request, session, jsonify
from flask_cors import CORS
from functools import wraps
import sqlite3
import os
from datetime import datetime, timedelta
import secrets
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
CORS(app)

# Database setup
DATABASE = 'comments.db'
MAX_COMMENT_LENGTH = 500

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        db.commit()
        db.close()

def require_login(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    db = get_db()
    cursor = db.cursor()
    
    try:
        password_hash = generate_password_hash(password)
        cursor.execute(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            (username, password_hash)
        )
        db.commit()
        user_id = cursor.lastrowid
        session['user_id'] = user_id
        session['username'] = username
        return jsonify({'message': 'User registered successfully', 'user_id': user_id}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 409
    finally:
        db.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()
    db.close()
    
    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = username
        return jsonify({'message': 'Logged in successfully', 'user_id': user['id']}), 200
    
    return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/comments', methods=['POST'])
@require_login
def create_comment():
    data = request.get_json()
    comment_content = data.get('content', '').strip()
    
    if not comment_content:
        return jsonify({'error': 'Comment content is required'}), 400
    
    if len(comment_content) > MAX_COMMENT_LENGTH:
        return jsonify({
            'error': f'Comment exceeds maximum length of {MAX_COMMENT_LENGTH} characters',
            'current_length': len(comment_content)
        }), 400
    
    user_id = session.get('user_id')
    
    db = get_db()
    cursor = db.cursor()
    
    try:
        cursor.execute(
            'INSERT INTO comments (user_id, content) VALUES (?, ?)',
            (user_id, comment_content)
        )
        db.commit()
        comment_id = cursor.lastrowid
        
        return jsonify({
            'message': 'Comment created successfully',
            'comment_id': comment_id,
            'user_id': user_id,
            'content': comment_content,
            'created_at': datetime.now().isoformat()
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': 'Failed to create comment'}), 500
    finally:
        db.close()

@app.route('/comments', methods=['GET'])
def get_comments():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT c.id, c.content, c.created_at, u.username
        FROM comments c
        JOIN users u ON c.user_id = u.id
        ORDER BY c.created_at DESC
    ''')
    comments = cursor.fetchall()
    db.close()
    
    comments_list = [dict(comment) for comment in comments]
    return jsonify({'comments': comments_list}), 200

@app.route('/comments/<int:comment_id>', methods=['GET'])
def get_comment(comment_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT c.id, c.content, c.created_at, u.username, c.user_id
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
    ''', (comment_id,))
    comment = cursor.fetchone()
    db.close()
    
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    
    return jsonify(dict(comment)), 200

@app.route('/comments/<int:comment_id>', methods=['DELETE'])
@require_login
def delete_comment(comment_id):
    user_id = session.get('user_id')
    
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute('SELECT user_id FROM comments WHERE id = ?', (comment_id,))
    comment = cursor.fetchone()
    
    if not comment:
        db.close()
        return jsonify({'error': 'Comment not found'}), 404
    
    if comment['user_id'] != user_id:
        db.close()
        return jsonify({'error': 'Unauthorized to delete this comment'}), 403
    
    try:
        cursor.execute('DELETE FROM comments WHERE id = ?', (comment_id,))
        db.commit()
        return jsonify({'message': 'Comment deleted successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'error': 'Failed to delete comment'}), 500
    finally:
        db.close()

@app.route('/user/comments', methods=['GET'])
@require_login
def get_user_comments():
    user_id = session.get('user_id')
    
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        'SELECT id, content, created_at FROM comments WHERE user_id = ? ORDER BY created_at DESC',
        (user_id,)
    )
    comments = cursor.fetchall()
    db.close()
    
    comments_list = [dict(comment) for comment in comments]
    return jsonify({'comments': comments_list}), 200

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    if not