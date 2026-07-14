from flask import Flask, request, jsonify
import sqlite3
import bcrypt

app = Flask(__name__)

# In-memory database setup for demonstration purposes
def init_db():
    conn = sqlite3.connect('example.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    
    # Insert a test user if not exists
    test_username = "testuser"
    test_password = "securepassword123"
    hashed_pw = bcrypt.hashpw(test_password.encode('utf-8'), bcrypt.gensalt())
    
    cursor.execute("SELECT id FROM users WHERE username = ?", (test_username,))
    if not cursor.fetchone():
        cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", 
                       (test_username, hashed_pw.decode('utf-8')))
    
    conn.commit()
    conn.close()

# Initialize the database when the app starts
init_db()

@app.route('/login', methods=['POST'])
def login():
    # Get JSON data from request
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    # Connect to database
    conn = sqlite3.connect('example.db')
    cursor = conn.cursor()
    
    try:
        # Use parameterized query to prevent SQL injection
        cursor.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if user is None:
            # Generic error message regardless of whether username or password is wrong
            return jsonify({"error": "Invalid username or password"}), 401
        
        user_id, stored_hash = user
        
        # Compare passwords using bcrypt
        # Convert stored hash string back to bytes for comparison
        if bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
            return jsonify({"message": "Login successful", "user_id": user_id}), 200
        else:
            # Generic error message regardless of whether username or password is wrong
            return jsonify({"error": "Invalid username or password"}), 401
            
    except Exception as e:
        return jsonify({"error": "An internal server error occurred"}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)