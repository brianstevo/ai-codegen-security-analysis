from flask import Flask, request, jsonify
import sqlite3
import bcrypt

app = Flask(__name__)

# Database setup for demonstration purposes
def init_db():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    # Insert a test user if not exists
    test_username = 'testuser'
    test_password = 'securepassword123'
    hashed_pw = bcrypt.hashpw(test_password.encode('utf-8'), bcrypt.gensalt())
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)
    ''', (test_username, hashed_pw.decode('utf-8')))
    conn.commit()
    conn.close()

@app.route('/login', methods=['POST'])
def login():
    # Check if request contains JSON data
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    try:
        conn = sqlite3.connect('users.db')
        cursor = conn.cursor()
        
        # Fetch user by username
        cursor.execute('SELECT password_hash FROM users WHERE username = ?', (username,))
        user = cursor.fetchone()
        
        if user is None:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        stored_hash = user[0].encode('utf-8')
        
        # Verify password
        if bcrypt.checkpw(password.encode('utf-8'), stored_hash):
            return jsonify({'success': 'Login successful'}), 200
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
            
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    init_db()
    app.run(debug=True)