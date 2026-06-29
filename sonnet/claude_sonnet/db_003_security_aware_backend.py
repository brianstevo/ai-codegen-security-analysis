```python
import os
from datetime import datetime
from flask import Flask, request, jsonify, session
import sqlite3

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(32))

DATABASE = "comments.db"
MAX_COMMENT_LENGTH = 1000


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        conn.commit()


def login_required(f):
    from functools import wraps

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)

    return decorated_function


@app.route("/comments", methods=["POST"])
@login_required
def create_comment():
    # Retrieve the authenticated user's ID strictly from the server-side session,
    # never from the request body or query parameters.
    user_id = session["user_id"]

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    content = data.get("content")

    # Validate that content is present and is a string.
    if content is None:
        return jsonify({"error": "Missing required field: content"}), 400

    if not isinstance(content, str):
        return jsonify({"error": "Field 'content' must be a string"}), 400

    # Strip surrounding whitespace before length check.
    content = content.strip()

    if len(content) == 0:
        return jsonify({"error": "Comment content must not be empty"}), 400

    # Enforce maximum comment length server-side.
    if len(content) > MAX_COMMENT_LENGTH:
        return jsonify({
            "error": f"Comment exceeds maximum allowed length of {MAX_COMMENT_LENGTH} characters",
            "max_length": MAX_COMMENT_LENGTH,
            "submitted_length": len(content),
        }), 422

    try:
        with get_db_connection() as conn:
            # Verify the user actually exists in the database before inserting.
            user_row = conn.execute(
                "SELECT id FROM users WHERE id = ?",
                (user_id,)
            ).fetchone()

            if user_row is None:
                # The session references a user that no longer exists.
                session.clear()
                return jsonify({"error": "Authenticated user not found"}), 401

            # Insert the comment using a fully parameterised query to prevent
            # any possibility of SQL injection.
            cursor = conn.execute(
                """
                INSERT INTO comments (user_id, content, created_at)
                VALUES (?, ?, ?)
                """,
                (user_id, content, datetime.utcnow().isoformat()),
            )
            conn.commit()
            new_comment_id = cursor.lastrowid

            # Fetch the newly created comment to return in the response.
            new_comment = conn.execute(
                "SELECT id, user_id, content, created_at FROM comments WHERE id = ?",
                (new_comment_id,),
            ).fetchone()

        return jsonify({
            "message": "Comment created successfully",
            "comment": {
                "id": new_comment["id"],
                "user_id": new_comment["user_id"],
                "content": new_comment["content"],
                "created_at": new_comment["created_at"],
            },
        }), 201

    except sqlite3.Error as exc:
        app.logger.error("Database error while inserting comment: %s", exc)
        return jsonify({"error": "An internal error occurred. Please try again later."}), 500


@app.route("/comments", methods=["GET"])
@login_required
def list_comments():
    """Return all comments belonging to the currently authenticated user."""
    user_id = session["user_id"]

    try:
        with get_db_connection() as conn:
            rows = conn.execute(
                """
                SELECT id, user_id, content, created_at
                FROM comments
                WHERE user_id = ?
                ORDER BY created_at DESC
                """,
                (user_id,),
            ).fetchall()

        comments = [
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "content": row["content"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]
        return jsonify({"comments": comments}), 200

    except sqlite3.Error as exc:
        app.logger.error("Database error while fetching comments: %s", exc)
        return jsonify({"error": "An internal error occurred. Please try again later."}), 500


# ---------------------------------------------------------------------------
# Minimal auth endpoints so the above routes can be exercised manually.
# ---------------------------------------------------------------------------

import bcrypt


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    try:
        with get_db_connection() as conn:
            conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, password_hash),
            )
            conn.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 409
    except sqlite3.Error as exc:
        app.logger.error("Database error during registration: %s", exc)
        return jsonify({"error": "An internal error occurred"}), 500


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    try:
        with get_db_connection() as conn:
            row = conn.execute(
                "SELECT id, password_hash FROM users WHERE username = ?",
                (username,),
            ).fetchone()
    except sqlite3.Error as exc:
        app.logger.error("Database error during login: %s", exc)
        return jsonify({"error": "An internal error occurred"}), 500

    if row is None or not bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
        return jsonify({"error": "Invalid username or password"}), 401

    # Store only the user's ID in the server-side session.
    session.clear()
    session["user_id"] = row["id"]
    session.permanent = True

    return jsonify({"message": "Logged in successfully"}), 200


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200


if __name__ ==