import sqlite3
from flask import Flask, request, jsonify, abort
from functools import wraps
import jwt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_key_12345'

# Mock database helper to simulate a real DB connection
def get_db_connection():
    conn = sqlite3.connect(':memory:', check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Setup mock data for demonstration purposes
    conn.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, role TEXT)')
    conn.execute('INSERT INTO users (username, email, role) VALUES (?, ?, ?)', ('alice', 'alice@example.com', 'user'))
    conn.execute('INSERT INTO users (username, email, role) VALUES (?, ?, ?)', ('bob', 'bob@example.com', 'user'))
    conn.execute('INSERT INTO users (username, email, role) VALUES (?, ?, ?)', ('admin', 'admin@example.com', 'admin'))
    conn.commit()
    return conn

db = get_db_connection()

def token_required(f):
    """Decorator to validate JWT and inject current_user into the function."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            # Expecting format "Bearer <token>"
            token_str = token.split(" ")[1] if " " in token else token
            data = jwt.decode(token_str, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data  # Contains {'user_id': X, 'role': Y}
        except Exception:
            return jsonify({'message': 'Token is invalid!'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/profile/<int:user_id>', methods=['GET'])
@token_required
def get_user_profile(current_user, user_id):
    """
    Fetches a user profile by ID with validation and authorization checks.
    """
    # 1. Validate that the ID is a positive integer
    if user_id <= 0:
        return jsonify({'error': 'Invalid User ID. Must be a positive integer.'}), 400

    # 2. Authorization Check
    # A user can view their own profile, or an admin can view any profile
    is_owner = current_user.get('user_id') == user_id
    is_admin = current_user.get('role') == 'admin'

    if not (is_owner or is_admin):
        return jsonify({'error': 'Unauthorized to view this profile.'}), 403

    # 3. Parameterized Query to prevent SQL Injection
    try:
        cursor = db.execute('SELECT id, username, email FROM users WHERE id = ?', (user_id,))
        user_row = cursor.fetchone()

        if user_row is None:
            return jsonify({'error': 'User not found.'}), 404

        # Convert sqlite3.Row to dictionary
        profile_data = dict(user_row)
        return jsonify(profile_data), 200

    except sqlite3.Error as e:
        return jsonify({'error': 'Database error occurred.'}), 500

# Helper route to generate a token for testing the profile route
@app.route('/get_token/<int:user_id>', methods=['GET'])
def get_test_token(user_id):
    cursor = db.execute('SELECT role FROM users WHERE id = ?', (user_id,))
    row = cursor.fetchone()
    if not row:
        return jsonify({'error': 'User does not exist'}), 404
    
    payload = {
        'user_id': user_id,
        'role': row['role']
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({'token': token})

if __name__ == '__main__':
    app.run(debug=True)