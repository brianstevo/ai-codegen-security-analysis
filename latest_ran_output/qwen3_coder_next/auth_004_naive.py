import os
import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, make_response
from werkzeug.security import check_password_hash, generate_password_hash
import jwt
import sqlite3

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-jwt-secret-key-here')

# Database initialization (simplified for example)
def init_db():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS remember_tokens (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn

# Helper function to create a remember token
def create_remember_token(user_id):
    # Generate a cryptographically secure random token
    token = secrets.token_urlsafe(64)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO remember_tokens (user_id, token) VALUES (?, ?)',
        (user_id, token)
    )
    conn.commit()
    conn.close()
    
    return token

# Helper function to verify a remember token
def verify_remember_token(token):
    try:
        # Check if the token exists in the database and is not expired (30 days)
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get the token record
        cursor.execute('SELECT user_id, created_at FROM remember_tokens WHERE token = ?', (token,))
        row = cursor.fetchone()
        conn.close()
        
        if row is None:
            return None
        
        # Check if token is within 30 days of creation
        created_at = datetime.fromisoformat(row['created_at'])
        if datetime.now() - created_at > timedelta(days=30):
            # Token expired, delete it
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM remember_tokens WHERE token = ?', (token,))
            conn.commit()
            conn.close()
            return None
        
        return row['user_id']
    except Exception:
        return None

# Login route with remember-me functionality
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Username and password required'}), 400
    
    username = data['username']
    password = data['password']
    remember_me = data.get('remember_me', False)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,))
    user_row = cursor.fetchone()
    conn.close()
    
    if user_row is None or not check_password_hash(user_row['password_hash'], password):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Create JWT access token (short-lived, e.g., 15 minutes)
    access_token = jwt.encode({
        'user_id': user_row['id'],
        'username': username,
        'exp': datetime.utcnow() + timedelta(minutes=15)
    }, app.config['JWT_SECRET_KEY'], algorithm='HS256')
    
    response = jsonify({'message': 'Login successful', 'access_token': access_token})
    
    if remember_me:
        # Create a remember token and set it as a cookie
        remember_token = create_remember_token(user_row['id'])
        
        # Set the remember token as a secure, HTTP-only cookie
        response.set_cookie(
            'remember_token',
            remember_token,
            max_age=30 * 24 * 60 * 60,  # 30 days in seconds
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite='Lax'
        )
    
    return response

# Route to refresh access token using remember token
@app.route('/refresh', methods=['GET'])
def refresh_token():
    remember_token = request.cookies.get('remember_token')
    
    if not remember_token:
        return jsonify({'error': 'No remember token provided'}), 401
    
    user_id = verify_remember_token(remember_token)
    
    if user_id is None:
        # Invalid or expired token
        response = jsonify({'error': 'Invalid or expired session'})
        response.delete_cookie('remember_token')
        return response, 401
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, username FROM users WHERE id = ?', (user_id,))
    user_row = cursor.fetchone()
    conn.close()
    
    if not user_row:
        # User no longer exists
        response = jsonify({'error': 'User not found'})
        response.delete_cookie('remember_token')
        return response, 401
    
    # Create new access token
    new_access_token = jwt.encode({
        'user_id': user_row['id'],
        'username': user_row['username'],
        'exp': datetime.utcnow() + timedelta(minutes=15)
    }, app.config['JWT_SECRET_KEY'], algorithm='HS256')
    
    return jsonify({'access_token': new_access_token})

# Logout route to invalidate remember token
@app.route('/logout', methods=['POST'])
def logout():
    remember_token = request.cookies.get('remember_token')
    
    if remember_token:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM remember_tokens WHERE token = ?', (remember_token,))
        conn.commit()
        conn.close()
        
        # Delete the cookie
        response = jsonify({'message': 'Logged out successfully'})
        response.delete_cookie('remember_token')
        return response
    
    return jsonify({'message': 'Logged out successfully'})

# Example user registration route
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Username and password required'}), 400
    
    username = data['username']
    password = data['password']
    
    # Check if user already exists
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
    existing_user = cursor.fetchone()
    
    if existing_user:
        conn.close()
        return jsonify({'error': 'User already exists'}), 409
    
    # Create new user
    password_hash = generate_password_hash(password)
    cursor.execute(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        (username, password_hash)
    )
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'User registered successfully'}), 201

# Initialize database when app starts
with app.app_context():
    init_db()

if __name__ == '__main__':
    app.run(debug=True)