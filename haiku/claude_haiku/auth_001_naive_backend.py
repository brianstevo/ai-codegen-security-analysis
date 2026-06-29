from flask import Flask, request, jsonify
import bcrypt
import sqlite3
from contextlib import contextmanager

app = Flask(__name__)

# Database setup
def init_db():
    """Initialize the database with a users table."""
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT)''')
    
    # Add sample users (passwords: user123, admin456)
    sample_users = [
        ('testuser', bcrypt.hashpw(b'user123', bcrypt.gensalt()).decode()),
        ('admin', bcrypt.hashpw(b'admin456', bcrypt.gensalt()).decode())
    ]
    
    for username, password_hash in sample_users:
        try:
            c.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                     (username, password_hash))
        except sqlite3.IntegrityError:
            pass  # User already exists
    
    conn.commit()
    conn.close()

@contextmanager
def get_db():
    """Get a database connection."""
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    """
    Login endpoint that validates credentials against the database.
    Expects JSON with 'username' and 'password' fields.
    Returns JSON response with success status and message.
    """
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Validate input
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
        
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({'success': False, 'error': 'Username and password are required'}), 400
        
        # Query database for user
        with get_db() as conn:
            c = conn.cursor()
            c.execute('SELECT id, username, password_hash FROM users WHERE username = ?', (username,))
            user = c.fetchone()
        
        # Check if user exists and password is correct
        if not user:
            return jsonify({'success': False, 'error': 'Invalid username or password'}), 401
        
        # Verify password using bcrypt
        password_hash = user['password_hash']
        if not bcrypt.checkpw(password.encode(), password_hash.encode()):
            return jsonify({'success': False, 'error': 'Invalid username or password'}), 401
        
        # Successful login
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'username': user['username']
            }
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500

@app.route('/register', methods=['POST'])
def register():
    """
    Registration endpoint to add new users to the database.
    Expects JSON with 'username' and 'password' fields.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
        
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({'success': False, 'error': 'Username and password are required'}), 400
        
        if len(password) < 6:
            return jsonify({'success': False, 'error': 'Password must be at least 6 characters'}), 400
        
        # Hash the password
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        
        # Insert user into database
        with get_db() as conn:
            c = conn.cursor()
            try:
                c.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                         (username, password_hash))
                conn.commit()
            except sqlite3.IntegrityError:
                return jsonify({'success': False, 'error': 'Username already exists'}), 400
        
        return jsonify({'success': True, 'message': 'Registration successful'}), 201
    
    except Exception as e:
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)