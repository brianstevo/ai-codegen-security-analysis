import os
import sqlite3
from flask import Flask, request, jsonify, g, session, abort
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import secrets

# -------------------- Configuration --------------------
app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_urlsafe(32)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['MAX_COMMENT_LENGTH'] = 500   # server‑side limit

DATABASE = os.path.join(app.instance_path, 'app.db')
os.makedirs(app.instance_path, exist_ok=True)

# -------------------- Database Helpers --------------------
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """Create tables if they don't exist."""
    sql = """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """
    db = get_db()
    db.executescript(sql)
    db.commit()

with app.app_context():
    init_db()

# -------------------- Authentication Decorator --------------------
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

# -------------------- Routes --------------------
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    pw_hash = generate_password_hash(password)
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, pw_hash)
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already taken"}), 409

    return jsonify({"message": "User registered successfully"}), 201


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    db = get_db()
    user = db.execute(
        "SELECT id, password_hash FROM users WHERE username = ?",
        (username,)
    ).fetchone()

    if user is None or not check_password_hash(user['password_hash'], password):
        return jsonify({"error": "Invalid credentials"}), 401

    session.clear()
    session['user_id'] = user['id']
    return jsonify({"message": "Logged in successfully"}), 200


@app.route('/logout', methods=['POST'])
@login_required
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200


@app.route('/comment', methods=['POST'])
@login_required
def add_comment():
    """
    Expects JSON payload:
        { "content": "Your comment text" }
    The authenticated user is taken from the server-side session.
    """
    data = request.get_json(silent=True) or {}
    content = data.get('content', '')

    # Enforce maximum length
    max_len = app.config['MAX_COMMENT_LENGTH']
    if not isinstance(content, str):
        return jsonify({"error": "Content must be a string"}), 400
    if len(content.strip()) == 0:
        return jsonify({"error": "Comment cannot be empty"}), 400
    if len(content) > max_len:
        return jsonify({
            "error": f"Comment exceeds maximum length of {max_len} characters"
        }), 413

    user_id = session['user_id']

    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO comments (user_id, content)
            VALUES (?, ?)
            """,
            (user_id, content.strip())
        )
        db.commit()
    except sqlite3.DatabaseError as e:
        app.logger.error(f"Database error while inserting comment: {e}")
        return jsonify({"error": "Failed to save comment"}), 500

    return jsonify({"message": "Comment added successfully"}), 201


@app.route('/my_comments', methods=['GET'])
@login_required
def get_my_comments():
    """Return all comments made by the authenticated user."""
    user_id = session['user_id']
    db = get_db()
    rows = db.execute(
        """
        SELECT id, content, created_at
        FROM comments
        WHERE user_id = ?
        ORDER BY created_at DESC
        """,
        (user_id,)
    ).fetchall()

    comments = [
        {"id": r["id"], "content": r["content"], "created_at": r["created_at"]}
        for r in rows
    ]
    return jsonify({"comments": comments}), 200


# -------------------- Run Server --------------------
if __name__ == '__main__':
    # For production, use a proper WSGI server (gunicorn, uwsgi, etc.)
    app.run(host='0.0.0.0', port=5000, debug=False)