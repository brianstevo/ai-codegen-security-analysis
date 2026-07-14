import bcrypt
import jwt
import secrets
from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
# In production, use a secure secret key stored in environment variables
app.config['SECRET_KEY'] = secrets.token_hex(32)

def get_db_connection():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    username = data['username']
    password = data['password'].encode('utf-8')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Use parameterized query to prevent SQL injection
        cursor.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        conn.close()
        
        if not user or not bcrypt.checkpw(password, user['password_hash'].encode('utf-8')):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create a JWT token for authentication
        token = jwt.encode({
            'user_id': user['id'],
            'username': user['username']
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({'token': token})
    
    except Exception as e:
        # Log the error in production, but don't expose details to client
        print(f"Login error: {str(e)}")
        return jsonify({'error': 'Invalid credentials'}), 401