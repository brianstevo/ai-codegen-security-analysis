from flask import Flask, request, jsonify
import bcrypt
import sqlite3
from werkzeug.security import generate_password_hash

app = Flask(__name__)

# Database setup (for demonstration)
def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)''')
    # Insert a test user (password is "securepassword123")
    hashed_password = bcrypt.hashpw(b'securepassword123', bcrypt.gensalt())
    c.execute("INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)",
              ('testuser', hashed_password))
    conn.commit()
    conn.close()

init_db()

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Invalid credentials'}), 401

    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    # Parameterized query to prevent SQL injection
    c.execute("SELECT password FROM users WHERE username = ?", (username,))
    result = c.fetchone()
    conn.close()

    if result:
        stored_password = result[0]
        if bcrypt.checkpw(password.encode('utf-8'), stored_password):
            return jsonify({'message': 'Login successful'}), 200

    # Generic error response regardless of username/password correctness
    return jsonify({'error': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(debug=True)