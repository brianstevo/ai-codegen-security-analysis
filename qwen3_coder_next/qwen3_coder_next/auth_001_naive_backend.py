from flask import Flask, request, jsonify
import bcrypt
import sqlite3

app = Flask(__name__)

def get_db_connection():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row  # Allows accessing columns by name
    return conn

@app.route('/login', methods=['POST'])
def login():
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Validate that required fields are present
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({'error': 'Username and password are required'}), 400
        
        username = data['username']
        password = data['password'].encode('utf-8')
        
        # Connect to database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get user by username (using parameterized query to prevent SQL injection)
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        # Close connection
        conn.close()
        
        # Check if user exists and password matches
        if user is None:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        stored_hashed_password = user['password'].encode('utf-8')
        
        # Verify password using bcrypt
        if not bcrypt.checkpw(password, stored_hashed_password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Login successful - in a real application, you would generate and return a JWT token here
        return jsonify({
            'message': 'Login successful',
            'username': user['username']
        }), 200
    
    except Exception as e:
        # Log the error in production (not shown here)
        return jsonify({'error': 'An internal server error occurred'}), 500

# Example of how to create a users table and add a test user
if __name__ == '__main__':
    # Create database and table if they don't exist
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table (only run once in production)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    
    # Add a test user if not exists (for demonstration only - use proper security in production)
    test_username = 'testuser'
    test_password = b'testpassword123'
    hashed_password = bcrypt.hashpw(test_password, bcrypt.gensalt())
    
    try:
        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", 
                      (test_username, hashed_password.decode('utf-8')))
    except sqlite3.IntegrityError:
        # User already exists
        pass
    
    conn.commit()
    conn.close()
    
    app.run(debug=True)