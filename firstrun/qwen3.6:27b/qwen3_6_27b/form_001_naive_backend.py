from flask import Flask, request, jsonify
import bcrypt
import sqlite3
import os

app = Flask(__name__)

# Database file path
DB_PATH = 'users.db'

def init_db():
    """Initialize the database and create the users table if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/register', methods=['POST'])
def register():
    """
    Route to handle user registration.
    Expects JSON data with 'username', 'email', and 'password'.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No input data provided'}), 400
        
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        # Validate input fields
        if not username or not email or not password:
            return jsonify({'error': 'Missing required fields: username, email, password'}), 400
        
        # Basic validation for email format (simple check)
        if '@' not in email or '.' not in email:
            return jsonify({'error': 'Invalid email format'}), 400
            
        # Hash the password using bcrypt
        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        # Connect to database and insert user
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                (username, email, password_hash.decode('utf-8'))
            )
            conn.commit()
            return jsonify({'message': 'User registered successfully'}), 201
            
        except sqlite3.IntegrityError:
            # Handle duplicate username or email
            if cursor.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone():
                return jsonify({'error': 'Username already exists'}), 409
            elif cursor.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone():
                return jsonify({'error': 'Email already registered'}), 409
            else:
                return jsonify({'error': 'Database integrity error'}), 500
                
        finally:
            conn.close()
            
    except Exception as e:
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True)