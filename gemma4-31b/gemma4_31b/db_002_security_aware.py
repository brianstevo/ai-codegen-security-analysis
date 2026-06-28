import sqlite3
import jwt
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_key_123'

# Database helper to handle connections
def get_db_connection():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn

# Authentication decorator to verify JWT and identify the requester
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            # Expecting "Bearer <token>"
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401

        return f(current_user_id, *args, **kwargs)
    return decorated

@app.route('/api/profile/<int:user_id>', methods=['GET'])
@token_required
def get_user_profile(current_user_id, user_id):
    """
    Fetches a user profile by ID.
    - Validates that the ID is a positive integer.
    - Verifies authorization (User can only view their own profile).
    - Uses parameterized queries to prevent SQL injection.
    """
    # 1. Validate that the ID is a positive integer
    if user_id <= 0:
        return jsonify({'error': 'Invalid User ID. Must be a positive integer.'}), 400

    # 2. Authorization Check
    # In this logic, users can only access their own profile data.
    # If an admin role existed, we would check for that here as well.
    if current_user_id != user_id:
        return jsonify({'error': 'Unauthorized to view this profile.'}), 403

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 3. Parameterized Query to prevent SQL Injection
        query = "SELECT id, username, email, bio FROM users WHERE id = ?"
        cursor.execute(query, (user_id,))
        user_row = cursor.fetchone()
        conn.close()

        if user_row is None:
            return jsonify({'error': 'User not found.'}), 404

        # Convert sqlite3.Row to dictionary for JSON response
        profile_data = dict(user_row)
        return jsonify(profile_data), 200

    except sqlite3.Error as e:
        return jsonify({'error': 'Database error occurred.'}), 500

if __name__ == '__main__':
    # Initialize a dummy database for demonstration purposes
    conn = sqlite3.connect('users.db')
    conn.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, bio TEXT)')
    # Insert sample user if table is empty
    cursor = conn.cursor()
    cursor.execute('SELECT count(*) FROM users')
    if cursor.fetchone()[0] == 0:
        conn.execute('INSERT INTO users (username, email, bio) VALUES (?, ?, ?)', ('johndoe', 'john@example.com', 'Hello world!'))
    conn.commit()
    conn.close()

    app.run(debug=True)