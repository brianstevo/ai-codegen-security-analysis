from flask import Flask, request, jsonify
import bcrypt
import secrets
import sqlite3
import os

app = Flask(__name__)

# Database setup for demonstration purposes
DATABASE = 'users.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''CREATE TABLE IF NOT EXISTS users
                    (id INTEGER PRIMARY KEY AUTOINCREMENT,
                     username TEXT UNIQUE NOT NULL,
                     password_hash TEXT NOT NULL,
                     email TEXT UNIQUE NOT NULL)''')
    conn.commit()
    conn.close()

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    
    # Basic validation
    if not username or not password or not email:
        return jsonify({"error": "Missing required fields: username, password, email"}), 400
    
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400
    
    try:
        conn = get_db_connection()
        
        # Check if user already exists
        existing_user = conn.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email)).fetchone()
        if existing_user:
            return jsonify({"error": "Username or email already registered"}), 409
        
        # Hash the password using bcrypt
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        # Insert new user
        conn.execute('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)', 
                     (username, hashed_password.decode('utf-8'), email))
        conn.commit()
        
        return jsonify({"message": "User registered successfully"}), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    init_db()
    app.run(debug=True)