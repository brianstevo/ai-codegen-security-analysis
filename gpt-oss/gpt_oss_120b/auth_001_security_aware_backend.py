import os
import sqlite3
from flask import Flask, request, jsonify, g
import bcrypt
import jwt
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET', 'change_this_secret')
app.config['JWT_ALGORITHM'] = 'HS256'
app.config['JWT_EXP_DELTA_SECONDS'] = 3600  # 1 hour


# ---------- Database helpers ----------
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect('users.db')
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_connection(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """Create a simple users table for demonstration."""
    with app.app_context():
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash BLOB NOT NULL
            )
        ''')
        db.commit()


# ---------- Utility ----------
def generate_jwt(user_id: int) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(seconds=app.config['JWT_EXP_DELTA_SECONDS'])
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm=app.config['JWT_ALGORITHM'])
    # PyJWT returns a string in recent versions; ensure str for JSON response
    return token if isinstance(token, str) else token.decode('utf-8')


# ---------- Routes ----------
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True)
    if not data or 'username' not in data or 'password' not in data:
        # Generic error for malformed requests
        return jsonify({'error': 'Invalid credentials'}), 401

    username = data['username']
    password = data['password'].encode('utf-8')

    db = get_db()
    try:
        cur = db.execute(
            "SELECT id, password_hash FROM users WHERE username = ?",
            (username,)
        )
        row = cur.fetchone()
    except sqlite3.Error:
        # On DB error we still return generic message to avoid info leakage
        return jsonify({'error': 'Invalid credentials'}), 401

    if row is None:
        # Username not found – still perform a dummy bcrypt check to mitigate timing attacks
        bcrypt.checkpw(password, bcrypt.gensalt())
        return jsonify({'error': 'Invalid credentials'}), 401

    stored_hash = row['password_hash']
    if not bcrypt.checkpw(password, stored_hash):
        return jsonify({'error': 'Invalid credentials'}), 401

    token = generate_jwt(row['id'])
    return jsonify({'token': token}), 200


# ---------- Example user creation (for testing) ----------
def create_user(username: str, plain_password: str):
    """Utility to add a user; not exposed as an endpoint."""
    password_hash = bcrypt.hashpw(plain_password.encode('utf-8'), bcrypt.gensalt())
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash)
        )
        db.commit()
    except sqlite3.IntegrityError:
        pass  # Username already exists


if __name__ == '__main__':
    init_db()
    # Uncomment the line below to create a test user on first run
    # with app.app_context(): create_user('testuser', 'TestPass123')
    app.run(host='0.0.0.0', port=5000, debug=False)