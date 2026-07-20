```python
from flask import Flask, request, jsonify, make_response
from functools import wraps
import secrets
import hashlib
from datetime import datetime, timedelta
import sqlite3
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Initialize SQLite database for token storage
def init_db():
    conn = sqlite3.connect('remember_me.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS remember_tokens
                 (id INTEGER PRIMARY KEY,
                  user_id INTEGER NOT NULL,
                  token_hash TEXT NOT NULL UNIQUE,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  last_used TIMESTAMP,
                  expires_at TIMESTAMP NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY,
                  username TEXT UNIQUE NOT NULL,
                  password_hash TEXT NOT NULL)''')
    conn.commit()
    conn.close()

init_db()

def hash_token(token):
    """Hash token for secure storage"""
    return hashlib.sha256(token.encode()).hexdigest()

def generate_remember_token():
    """Generate a secure random token using secrets"""
    return secrets.token_urlsafe(32)

def store_remember_token(user_id, token, expiry_days=30):
    """Store hashed token in database mapped to user"""
    conn = sqlite3.connect('remember_me.db')
    c = conn.cursor()
    token_hash = hash_token(token)
    expires_at = datetime.utcnow() + timedelta(days=expiry_days)
    
    try:
        c.execute('''INSERT INTO remember_tokens (user_id, token_hash, last_used, expires_at)
                     VALUES (?, ?, ?, ?)''',
                  (user_id, token_hash, datetime.utcnow(), expires_at))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False

def verify_and_rotate_token(token):
    """Verify token, return user_id, and rotate the token"""
    conn = sqlite3.connect('remember_me.db')
    c = conn.cursor()
    token_hash = hash_token(token)
    
    # Verify token exists and hasn't expired
    c.execute('''SELECT id, user_id, expires_at FROM remember_tokens
                 WHERE token_hash = ? AND expires_at > datetime('now')''',
              (token_hash,))
    result = c.fetchone()
    
    if not result:
        conn.close()
        return None, None
    
    token_id, user_id, expires_at = result
    
    # Update last_used timestamp
    c.execute('''UPDATE remember_tokens SET last_used = ?
                 WHERE id = ?''',
              (datetime.utcnow(), token_id))
    conn.commit()
    conn.close()
    
    return user_id, token_hash

def rotate_remember_token(old_token_hash):
    """Delete old token and generate new one"""
    conn = sqlite3.connect('remember_me.db')
    c = conn.cursor()
    
    # Get user_id from old token
    c.execute('SELECT user_id FROM remember_tokens WHERE token_hash = ?',
              (old_token_hash,))
    result = c.fetchone()
    
    if not result:
        conn.close()
        return None
    
    user_id = result[0]
    
    # Delete old token
    c.execute('DELETE FROM remember_tokens WHERE token_hash = ?',
              (old_token_hash,))
    conn.commit()
    conn.close()
    
    # Generate and store new token
    new_token = generate_remember_token()
    store_remember_token(user_id, new_token)
    
    return new_token

def set_remember_me_cookie(response, token, expiry_days=30):
    """Set secure remember-me cookie with httponly, secure, and samesite attributes"""
    response.set_cookie(
        'remember_me',
        token,
        max_age=expiry_days * 24 * 60 * 60,
        httponly=True,
        secure=True,  # Only sent over HTTPS
        samesite='Strict',  # CSRF protection
        path='/'
    )
    return response

def get_remember_me_cookie():
    """Safely retrieve remember-me cookie"""
    return request.cookies.get('remember_me')

def remember_me_login(f):
    """Decorator to check remember-me token and auto-login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_remember_me_cookie()
        
        if token:
            user_id, old_token_hash = verify_and_rotate_token(token)
            
            if user_id:
                # Token is valid, rotate it
                new_token = rotate_remember_token(old_token_hash)
                
                if new_token:
                    # Store user info in request context
                    request.user_id = user_id
                    
                    # Update cookie with new rotated token
                    @wraps(f)
                    def with_new_cookie(*args, **kwargs):
                        response = make_response(f(*args, **kwargs))
                        set_remember_me_cookie(response, new_token)
                        return response
                    
                    return with_new_cookie(*args, **kwargs)
        
        request.user_id = None
        return f(*args, **kwargs)
    
    return decorated_function

# Demo routes
@app.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    conn = sqlite3.connect('remember_me.db')
    c = conn.cursor()
    
    # Hash password (in production, use bcrypt)
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    try:
        c.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                  (username, password_hash))
        conn.commit()
        user_id = c.lastrowid
        conn.close()
        
        return jsonify({'user_id': user_id, 'message': 'User registered'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Username already exists'}), 400

@app.route('/login', methods=['POST'])
def login():
    """Login user and optionally set remember-me cookie"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    remember_me = data.get('remember_me', False)
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    conn = sqlite3.connect('remember_me.db')
    c = conn.cursor()
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    c.execute('SELECT id FROM users WHERE username = ? AND password_hash = ?',
              (username, password_hash))
    user = c.fetchone()
    conn.close()
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    user_id = user[0]
    response = make_response(jsonify({'user_id': user_id, 'message': 'Logged in'}))
    
    if remember_me:
        # Generate and store remember-me token
        token = generate_remember_token()
        store_remember_token(user_id, token)
        
        # Set secure cookie
        response = set_remember_me_cookie(response, token)
    
    return response, 200

@app.route('/protected',