from flask import Flask, request, jsonify
import sqlite3
import bcrypt

app = Flask(__name__)

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/register', methods=['POST'])
def register():
    """
    Registers a new user account.
    Expects JSON data with 'username', 'email', and 'password'.
    """
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    # Basic validation
    if not all([username, email, password]):
        return jsonify({'error': 'Missing required fields'}), 400

    # Hash the password using bcrypt
    # bcrypt.gensalt() generates a salt
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Insert user into the database
        cursor.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            (username, email, password_hash)
        )
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'User created successfully'}), 201

    except sqlite3.IntegrityError:
        # Handle duplicate username or email
        return jsonify({'error': 'Username or email already exists'}), 409

    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500