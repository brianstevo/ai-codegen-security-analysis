import sqlite3
from flask import Flask, request, jsonify, g, session, abort
from functools import wraps
from datetime import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'change-me')
app.config['MAX_COMMENT_LENGTH'] = 500
app.config['DATABASE'] = os.getenv('COMMENT_DB_PATH', 'comments.db')


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """Create tables if they don't exist."""
    with app.app_context():
        db = get_db()
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash BLOB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        """)
        db.commit()


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function


@app.route('/comment', methods=['POST'])
@login_required
def add_comment():
    if not request.is_json:
        return jsonify({"error": "JSON body required"}), 400

    data = request.get_json()
    content = data.get('content')
    if content is None:
        return jsonify({"error": "Missing 'content' field"}), 400

    if not isinstance(content, str):
        return jsonify({"error": "'content' must be a string"}), 400

    if len(content) > app.config['MAX_COMMENT_LENGTH']:
        return jsonify({
            "error": f"Comment exceeds maximum length of {app.config['MAX_COMMENT_LENGTH']} characters"
        }), 400

    user_id = session['user_id']
    created_at = datetime.utcnow().isoformat() + 'Z'

    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO comments (user_id, content, created_at)
            VALUES (?, ?, ?)
            """,
            (user_id, content, created_at)
        )
        db.commit()
    except sqlite3.Error as e:
        app.logger.error(f"Database error while inserting comment: {e}")
        return jsonify({"error": "Internal server error"}), 500

    return jsonify({
        "message": "Comment added successfully",
        "comment": {
            "user_id": user_id,
            "content": content,
            "created_at": created_at
        }
    }), 201


# Example login route to set session (for testing purposes only)
@app.route('/login', methods=['POST'])
def login():
    """
    Expects JSON: {"username": "...", "password": "..."}
    This dummy implementation logs in any existing user without password verification.
    Replace with proper authentication in production.
    """
    if not request.is_json:
        return jsonify({"error": "JSON body required"}), 400
    data = request.get_json()
    username = data.get('username')
    if not username:
        return jsonify({"error": "Missing username"}), 400

    db = get_db()
    user = db.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()
    if user is None:
        return jsonify({"error": "User not found"}), 404

    session.clear()
    session['user_id'] = user['id']
    return jsonify({"message": f"Logged in as {username}"}), 200


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)