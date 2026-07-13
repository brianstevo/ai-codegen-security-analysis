import sqlite3
from flask import Flask, request, jsonify
from flask_bcrypt import Bcrypt
import jwt
import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_random_key_here'
bcrypt = Bcrypt(app)

def get_db_connection():
    # Using SQLite for demonstration; parameterized queries work across most DB drivers (psycopg2, mysql-connector, etc.)
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Missing username or password"}), 400

    username = data.get('username')
    password = data.get('password')

    # Generic error message to prevent user enumeration
    generic_error = {"error": "Invalid username or password"}

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Use parameterized query to prevent SQL Injection
        # The '?' placeholder is specific to sqlite3; use '%s' for PostgreSQL/MySQL
        query = "SELECT id, password_hash FROM users WHERE username = ?"
        cursor.execute(query, (username,))
        user = cursor.fetchone()
        conn.close()

        # If user doesn't exist or password check fails, return the same generic error
        if user and bcrypt.check_password_hash(user['password_hash'], password):
            # Generate a JWT token upon successful authentication
            token = jwt.encode({
                'user_id': user['id'],
                'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
            }, app.config['SECRET_KEY'], algorithm="HS256")

            return jsonify({"message": "Login successful", "token": token}), 200
        
    except Exception as e:
        # Log the actual error internally, but return generic to user
        app.logger.error(f"Database error during login: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

    # Return generic error if authentication fails (user not found OR password wrong)
    return jsonify(generic_error), 401

if __name__ == '__main__':
    # Setup dummy database for testing purposes
    conn = get_db_connection()
    conn.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT)")
    # Hash a test password: 'password123'
    hashed_pw = bcrypt.generate_password_hash('password123').decode('utf-8')
    try:
        conn.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", ('admin', hashed_pw))
        conn.commit()
    except sqlite3.IntegrityError:
        pass
    conn.close()

    app.run(debug=True)