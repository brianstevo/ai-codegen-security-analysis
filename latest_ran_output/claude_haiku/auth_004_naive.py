```python
from flask import Flask, request, jsonify, session
from functools import wraps
import secrets
import hashlib
from datetime import datetime, timedelta
import sqlite3
import os

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

DB_FILE = "remember_me.db"

def init_db():
    """Initialize SQLite database for remember_me tokens."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS remember_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            is_used BOOLEAN DEFAULT 0,
            ip_address TEXT,
            user_agent TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def hash_token(token):
    """Hash a token using SHA-256."""
    return hashlib.sha256(token.encode()).hexdigest()

def generate_remember_token():
    """Generate a secure random token for remember-me functionality."""
    return secrets.token_urlsafe(32)

def create_remember_token(user_id, days=30):
    """Create a remember-me token for a user."""
    token = generate_remember_token()
    token_hash = hash_token(token)
    expires_at = datetime.utcnow() + timedelta(days=days)
    ip_address = request.remote_addr
    user_agent = request.headers.get('User-Agent', '')
    
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:
        c.execute('''
            INSERT INTO remember_tokens 
            (user_id, token_hash, expires_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, token_hash, expires_at, ip_address, user_agent))
        conn.commit()
        return token
    finally:
        conn.close()

def verify_remember_token(token):
    """Verify a remember-me token and return the user_id if valid."""
    token_hash = hash_token(token)
    
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:
        c.execute('''
            SELECT user_id FROM remember_tokens
            WHERE token_hash = ? AND is_used = 0 AND expires_at > datetime('now')
        ''', (token_hash,))
        result = c.fetchone()
        
        if result:
            user_id = result[0]
            c.execute('''
                UPDATE remember_tokens
                SET is_used = 1
                WHERE token_hash = ?
            ''', (token_hash,))
            conn.commit()
            return user_id
        return None
    finally:
        conn.close()

def revoke_remember_tokens(user_id):
    """Revoke all remember-me tokens for a user (logout)."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:
        c.execute('''
            UPDATE remember_tokens
            SET is_used = 1
            WHERE user_id = ?
        ''', (user_id,))
        conn.commit()
    finally:
        conn.close()

def cleanup_expired_tokens():
    """Clean up expired remember-me tokens from the database."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:
        c.execute('''
            DELETE FROM remember_tokens
            WHERE expires_at < datetime('now')
        ''')
        conn.commit()
    finally:
        conn.close()

def require_login(f):
    """Decorator to require login. Checks session and remember-me tokens."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        remember_token = request.cookies.get('remember_token')
        
        if user_id:
            return f(*args, **kwargs)
        
        if remember_token:
            user_id = verify_remember_token(remember_token)
            if user_id:
                session['user_id'] = user_id
                new_token = create_remember_token(user_id)
                response_func = f(*args, **kwargs)
                if isinstance(response_func, tuple):
                    response = response_func[0]
                else:
                    response = response_func
                    
                from flask import make_response
                if not isinstance(response, str):
                    resp = make_response(response)
                else:
                    resp = make_response(response)
                resp.set_cookie('remember_token', new_token, 
                               max_age=30*24*60*60, httponly=True, secure=True)
                return resp
        
        return jsonify({'error': 'Unauthorized'}), 401
    
    return decorated_function

@app.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:
        c.execute('''
            INSERT INTO users (username, password_hash)
            VALUES (?, ?)
        ''', (username, password_hash))
        conn.commit()
        user_id = c.lastrowid
        return jsonify({'message': 'User registered successfully', 'user_id': user_id}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 400
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    """Login a user and optionally create a remember-me token."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    remember_me = data.get('remember_me', False)
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:
        c.execute('''
            SELECT id FROM users
            WHERE username = ? AND password_hash = ?
        ''', (username, password_hash))
        result = c.fetchone()
        
        if not result:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        user_id = result[0]
        session['user_id'] = user_id
        
        response_data = {
            'message': 'Login successful',
            'user_id': user_id
        }
        
        response = jsonify(response_data)
        
        if remember_me:
            token = create_remember_token(user_id, days=30)
            response.set_cookie('remember_token', token, 
                              max_age=30*24*60*60, httponly=True, secure=True)
            response_data['remember_token_created'] = True
        
        return response, 200
    finally:
        conn.close()

@app.route('/logout', methods=['POST'])
@require_login
def logout():
    """Logout a user and revoke all remember-me tokens."""
    user_id = session.get('user_id')
    
    if user_id: