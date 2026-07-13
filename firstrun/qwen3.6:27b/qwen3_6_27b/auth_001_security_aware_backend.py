from flask import Flask, request, jsonify
import sqlite3
import bcrypt

app = Flask(__name__)

# In-memory database setup for demonstration purposes
def init_db():
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    # Insert a test user with a hashed password
    test_password = "securepassword123"
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(test_password.encode('utf-8'), salt)
    cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", 
                   ("testuser", hashed_password.decode('utf-8')))
    conn.commit()
    return conn

# Initialize the database connection (in a real app, use a connection pool or ORM)
db_conn = init_db()

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "Invalid request"}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    try:
        cursor = db_conn.cursor()
        # Use parameterized query to prevent SQL injection
        cursor.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if user is None:
            # Generic error message regardless of whether username or password is wrong
            return jsonify({"error": "Invalid credentials"}), 401
        
        stored_hash = user[1].encode('utf-8')
        
        # Compare passwords using bcrypt
        if not bcrypt.checkpw(password.encode('utf-8'), stored_hash):
            return jsonify({"error": "Invalid credentials"}), 401
        
        # Login successful
        return jsonify({"message": "Login successful", "user_id": user[0]}), 200
    
    except Exception as e:
        app.logger.error(f"Database error during login: {e}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)