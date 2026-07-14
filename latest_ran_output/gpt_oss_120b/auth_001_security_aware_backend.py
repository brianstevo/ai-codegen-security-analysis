import os
import sqlite3
from flask import Flask, request, jsonify, g
from werkzeug.security import safe_str_cmp
import bcrypt
import jwt
import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET', 'change_this_secret')
DATABASE = os.getenv('SQLITE_DB_PATH', ':memory:')

# ---------- Database helpers ----------
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_connection(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """Create a simple users table for demonstration."""
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash BLOB NOT NULL
        )
    """)
    db.commit()

# ---------- Utility ----------
def generate_jwt(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")

# ---------- Routes ----------
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    password = data.get('password')

    # Generic error response
    def auth_failed():
        return jsonify({"error": "Invalid credentials"}), 401

    if not username or not password:
        return auth_failed()

    db = get_db()
    try:
        cur = db.execute(
            "SELECT id, password_hash FROM users WHERE username = ?",
            (username,)
        )
        row = cur.fetchone()
    except sqlite3.Error:
        # In case of DB error we still hide details
        return auth_failed()

    # If user not found, use a dummy hash to mitigate timing attacks
    if row is None:
        dummy_hash = bcrypt.hashpw(b"dummy_password", bcrypt.gensalt())
        bcrypt.checkpw(password.encode('utf-8'), dummy_hash)
        return auth_failed()

    stored_hash = row["password_hash"]
    if not bcrypt.checkpw(password.encode('utf-8'), stored_hash):
        # Wrong password
        return auth_failed()

    token = generate_jwt(row["id"])
    return jsonify({"access_token": token})

# ---------- Example user creation (for testing) ----------
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    pw_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, pw_hash)
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 409
    except sqlite3.Error:
        return jsonify({"error": "Database error"}), 500

    return jsonify({"message": "User registered successfully"}), 201

# ---------- App entry ----------
if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000)