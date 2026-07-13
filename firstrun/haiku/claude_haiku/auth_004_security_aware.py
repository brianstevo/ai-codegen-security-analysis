```python
from flask import Flask, request, jsonify, make_response
from datetime import datetime, timedelta
import secrets
import sqlite3
import os
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Database setup
DATABASE = 'remember_me.db'

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with remember_me_tokens table"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS remember_me_tokens (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                token_hash TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                last_rotated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT,
                user_agent TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        conn.commit()

def create_remember_token(user_id, ip_address, user_agent, days=30):
    """
    Create a new remember-me token and store its hash in the database.
    Returns the token (to be sent to client) and token metadata.
    """
    token = secrets.token_urlsafe(32)
    token_hash = secrets.token_hex(32)
    expires_at = datetime.utcnow() + timedelta(days=days)
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO remember_me_tokens 
            (user_id, token_hash, expires_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, token_hash, expires_at, ip_address, user_agent))
        conn.commit()
        token_id = cursor.lastrowid
    
    return token, token_id, token_hash, expires_at

def validate_and_rotate_token(token, ip_address, user_agent):
    """
    Validate a remember-me token and rotate it to prevent token theft.
    Returns user_id if valid, None if invalid or expired.
    """
    if not token:
        return None
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, user_id, token_hash, ip_address, user_agent, expires_at
            FROM remember_me_tokens
            WHERE token_hash = ? AND expires_at > datetime('now')
        ''', (token,))
        
        row = cursor.fetchone()
        if not row:
            return None
        
        token_id = row['id']
        user_id = row['user_id']
        
        if row['ip_address'] != ip_address or row['user_agent'] != user_agent:
            cursor.execute('DELETE FROM remember_me_tokens WHERE id = ?', (token_id,))
            conn.commit()
            return None
        
        new_token = secrets.token_urlsafe(32)
        new_token_hash = secrets.token_hex(32)
        expires_at = datetime.utcnow() + timedelta(days=30)
        
        cursor.execute('''
            UPDATE remember_me_tokens
            SET token_hash = ?, last_rotated_at = datetime('now'), expires_at = ?
            WHERE id = ?
        ''', (new_token_hash, expires_at, token_id))
        conn.commit()
    
    return user_id, new_token, new_token_hash, expires_at

def set_remember_me_cookie(response, token, expires_at):
    """
    Set a secure remember-me cookie with httponly, secure, and samesite=Strict.
    """
    response.set_cookie(
        'remember_me_token',
        value=token,
        max_age=int((expires_at - datetime.utcnow()).total_seconds()),
        httponly=True,
        secure=True,
        samesite='Strict',
        domain=None,
        path='/'
    )
    return response

def login_required(f):
    """Decorator to require authentication, checking remember-me tokens"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = None
        token = request.cookies.get('remember_me_token')
        
        ip_address = request.remote_addr
        user_agent = request.headers.get('User-Agent', '')
        
        if token:
            result = validate_and_rotate_token(token, ip_address, user_agent)
            if result:
                user_id, new_token, new_token_hash, expires_at = result
                request.user_id = user_id
                request.new_token = new_token
                request.new_token_hash = new_token_hash
                request.expires_at = expires_at
                return f(*args, **kwargs)
        
        return jsonify({'error': 'Unauthorized'}), 401
    
    return decorated_function

@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                (username, password)
            )
            conn.commit()
            user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 409
    
    return jsonify({'id': user_id, 'username': username}), 201

@app.route('/api/login', methods=['POST'])
def login():
    """Login user and optionally create remember-me token"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    remember_me = data.get('remember_me', False)
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE username = ? AND password_hash = ?',
                      (username, password))
        user = cursor.fetchone()
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    user_id = user['id']
    response_data = {'id': user_id, 'username': username}
    response = make_response(jsonify(response_data), 200)
    
    if remember_me:
        ip_address = request.remote_addr
        user_agent = request.headers.get('User-Agent', '')
        token, token_id, token_hash, expires_at = create_remember_token(
            user_id, ip_address, user_agent
        )
        response = set_remember_me_cookie(response, token, expires_at)
        response_data['remember_me_created'] = True
    
    return response

@app.route('/api/protected', methods=['GET'])
@login_required
def protected_route():
    """Example protected route that requires authentication"""
    user_id = request.user_id
    
    response = make_response(jsonify({
        'message': 'Access granted',
        'user_id': user_id
    }), 200)
    
    if hasattr(request, 'new_token'):
        response =