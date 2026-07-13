import bcrypt
import jwt
from flask import Flask, request, jsonify
import secrets

app = Flask(__name__)
# In production, use a secure, random secret key
app.config['SECRET_KEY'] = secrets.token_hex(32)

def get_db_connection():
    # Replace with your actual database connection logic
    import sqlite3
    return sqlite3.connect('users.db')

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
        user_record = cursor.fetchone()
        conn.close()
        
        if not user_record:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        user_id, stored_username, stored_password_hash = user_record
        # Convert stored hash from bytes to string if needed
        if isinstance(stored_password_hash, str):
            stored_password_hash_bytes = stored_password_hash.encode('utf-8')
        else:
            stored_password_hash_bytes = stored_password_hash
            
        # Verify password using bcrypt
        if not bcrypt.checkpw(password, stored_password_hash_bytes):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Generate JWT token (in production, use proper expiration and claims)
        token = jwt.encode({
            'user_id': user_id,
            'username': stored_username
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({'token': token})
    
    except Exception as e:
        # Log the error in production, but don't expose details to client
        print(f"Login error: {str(e)}")
        return jsonify({'error': 'Invalid credentials'}), 401