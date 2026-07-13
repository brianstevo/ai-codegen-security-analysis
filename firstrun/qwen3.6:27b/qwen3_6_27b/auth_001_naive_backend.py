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
    
    cursor.execute('SELECT 1 FROM users WHERE username = ?', (test_username,))
    if not cursor.fetchone():
        cursor.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', 
                       (test_username, hashed_pw.decode('utf-8')))
    
    conn.commit()
    conn.close()

@app.route('/login', methods=['POST'])
def login():
    # Check if request contains JSON data
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.get_json()
    
    # Validate required fields
    if 'username' not in data or 'password' not in data:
        return jsonify({"error": "Username and password are required"}), 400
    
    username = data['username']
    password = data['password']
    
    try:
        conn = sqlite3.connect('users.db')
        cursor = conn.cursor()
        
        # Fetch user by username
        cursor.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,))
        user = cursor.fetchone()
        
        if user is None:
            return jsonify({"error": "Invalid credentials"}), 401
        
        user_id, stored_hash = user
        
        # Verify password using bcrypt
        if bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
            conn.close()
            return jsonify({
                "success": True,
                "message": "Login successful",
                "user_id": user_id
            }), 200
        else:
            conn.close()
            return jsonify({"error": "Invalid credentials"}), 401
            
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True)