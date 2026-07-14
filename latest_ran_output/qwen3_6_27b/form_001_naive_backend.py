from flask import Flask, request, jsonify
import bcrypt
import sqlite3

app = Flask(__name__)

DATABASE = 'users.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
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
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({"error": "Missing required fields: username, email, password"}), 400
    
    # Basic validation for email format (simple check)
    if '@' not in email:
        return jsonify({"error": "Invalid email format"}), 400
        
    # Hash the password
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password_bytes, salt)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if username or email already exists
        existing_user = cursor.execute(
            "SELECT id FROM users WHERE username = ? OR email = ?", 
            (username, email)
        ).fetchone()
        
        if existing_user:
            return jsonify({"error": "Username or email already registered"}), 409
        
        # Insert new user
        cursor.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, hashed_password.decode('utf-8'))
        )
        
        conn.commit()
        return jsonify({"message": "User registered successfully"}), 201
        
    except sqlite3.Error as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    init_db()
    app.run(debug=True)