from flask import Flask, request, jsonify, session
from flask_bcrypt import Bcrypt
import secrets
import sqlite3
import os
from datetime import timedelta
from functools import wraps

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True  # Set to True in production (HTTPS)
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)

bcrypt = Bcrypt(app)

DATABASE = 'users.db'


def get_db_connection():
    """Create and return a database connection."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database and create users table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()


def login_required(f):
    """Decorator to protect routes that require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({
                'success': False,
                'message': 'Authentication required. Please log in.'
            }), 401
        return f(*args, **kwargs)
    return decorated_function


@app.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()

    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400

    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    # Validate input
    if not username or not email or not password:
        return jsonify({
            'success': False,
            'message': 'Username, email, and password are required'
        }), 400

    if len(password) < 8:
        return jsonify({
            'success': False,
            'message': 'Password must be at least 8 characters long'
        }), 400

    # Hash the password
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            (username, email, password_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()

        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'user_id': user_id
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({
            'success': False,
            'message': 'Username or email already exists'
        }), 409
    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'An error occurred during registration'
        }), 500


@app.route('/login', methods=['POST'])
def login():
    """
    Authenticate user and create a session.
    Stores the user ID and additional info in the session upon successful login.
    """
    data = request.get_json()

    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '')

    # Validate input
    if not username or not password:
        return jsonify({
            'success': False,
            'message': 'Username and password are required'
        }), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT id, username, email, password_hash FROM users WHERE username = ?',
            (username,)
        )
        user = cursor.fetchone()
        conn.close()

        # Check if user exists and password is correct
        if user is None or not bcrypt.check_password_hash(user['password_hash'], password):
            return jsonify({
                'success': False,
                'message': 'Invalid username or password'
            }), 401

        # Clear any existing session data before creating a new session
        session.clear()

        # Create a new session and store user information
        session.permanent = True  # Use the PERMANENT_SESSION_LIFETIME config
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['email'] = user['email']

        # Generate a unique session token for additional security
        session['session_token'] = secrets.token_hex(16)

        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email']
            }
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'An error occurred during login'
        }), 500


@app.route('/logout', methods=['POST'])
@login_required
def logout():
    """Log out the current user by clearing the session."""
    session.clear()
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    }), 200


@app.route('/profile', methods=['GET'])
@login_required
def profile():
    """Get the profile of the currently logged-in user."""
    user_id = session.get('user_id')

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT id, username, email, created_at FROM users WHERE id = ?',
            (user_id,)
        )
        user = cursor.fetchone()
        conn.close()

        if not user:
            session.clear()
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404

        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'created_at': user['created_at']
            }
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'An error occurred while fetching profile'
        }), 500


@app.route('/session-status', methods=['GET'])
def session_status():
    """Check if the user currently has an active session."""
    if 'user_id' in session:
        return jsonify({
            'success': True,
            'logged_in': True,
            'user_id': session.get('user_id'),
            'username': session.get('username')
        }), 200
    else:
        return jsonify({
            'success': True,
            'logged_in': False,
            'message': 'No active session'
        }), 200


if __name__ == '__main__':
    init_db()
    app.run(debug=False)