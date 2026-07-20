```python
import os
from flask import Flask, request, jsonify, session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import sqlite3
from datetime import datetime
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(32))

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"]
)

DATABASE = os.environ.get("DATABASE_PATH", "app.db")
MAX_COMMENT_LENGTH = 1000
MIN_COMMENT_LENGTH = 1


def get_db():
    """Create a new database connection for the current context."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialise the database schema."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                username  TEXT    NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                content    TEXT    NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        conn.commit()


def login_required(f):
    """Decorator that ensures the user is authenticated via the session."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Authentication required."}), 401
        return f(*args, **kwargs)
    return decorated


def get_authenticated_user_id():
    """
    Return the authenticated user's ID exclusively from the server-side session.
    Never trust user_id values from the request body or query string.
    """
    return session.get("user_id")


def validate_comment_content(content):
    """
    Validate comment content server-side.

    Returns (cleaned_content, error_message).
    error_message is None when the content is valid.
    """
    if content is None:
        return None, "Comment content is required."

    if not isinstance(content, str):
        return None, "Comment content must be a string."

    # Strip leading/trailing whitespace before length check
    content = content.strip()

    if len(content) < MIN_COMMENT_LENGTH:
        return None, f"Comment must be at least {MIN_COMMENT_LENGTH} character(s)."

    if len(content) > MAX_COMMENT_LENGTH:
        return None, (
            f"Comment exceeds the maximum allowed length of "
            f"{MAX_COMMENT_LENGTH} characters "
            f"(received {len(content)} characters)."
        )

    return content, None


@app.route("/comments", methods=["POST"])
@login_required
@limiter.limit("10 per minute")
def create_comment():
    """
    Insert a new comment for the currently authenticated user.

    - The user identity is taken from the server-side session only.
    - The comment content is validated for length server-side.
    - The INSERT uses a parameterised query to prevent SQL injection.
    """
    # ------------------------------------------------------------------ #
    # 1. Identify the user from the session — never from the request body #
    # ------------------------------------------------------------------ #
    user_id = get_authenticated_user_id()
    # login_required already guarantees user_id is set, but be explicit.
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    # ------------------------------------------------------------------ #
    # 2. Parse and validate the request payload                           #
    # ------------------------------------------------------------------ #
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid or missing JSON body."}), 400

    raw_content = data.get("content")

    content, validation_error = validate_comment_content(raw_content)
    if validation_error:
        return jsonify({"error": validation_error}), 422

    # ------------------------------------------------------------------ #
    # 3. Persist the comment using a parameterised query                  #
    # ------------------------------------------------------------------ #
    try:
        with get_db() as conn:
            # Verify the user still exists in the database
            user_row = conn.execute(
                "SELECT id FROM users WHERE id = ?",
                (user_id,)
            ).fetchone()

            if user_row is None:
                # The session references a user that no longer exists
                session.clear()
                return jsonify({"error": "User account not found."}), 401

            cursor = conn.execute(
                """
                INSERT INTO comments (user_id, content, created_at)
                VALUES (?, ?, ?)
                """,
                (user_id, content, datetime.utcnow().isoformat())
            )
            conn.commit()
            comment_id = cursor.lastrowid

    except sqlite3.IntegrityError as exc:
        app.logger.error("IntegrityError while inserting comment: %s", exc)
        return jsonify({"error": "Could not save comment due to a data conflict."}), 409
    except sqlite3.DatabaseError as exc:
        app.logger.error("DatabaseError while inserting comment: %s", exc)
        return jsonify({"error": "A database error occurred."}), 500

    # ------------------------------------------------------------------ #
    # 4. Return the created resource                                       #
    # ------------------------------------------------------------------ #
    return jsonify({
        "message": "Comment created successfully.",
        "comment": {
            "id":         comment_id,
            "user_id":    user_id,
            "content":    content,
            "created_at": datetime.utcnow().isoformat(),
        }
    }), 201


# --------------------------------------------------------------------------- #
# Minimal login / logout helpers so the route can be exercised in isolation.  #
# Replace these with your real authentication flow.                            #
# --------------------------------------------------------------------------- #

@app.route("/dev/login", methods=["POST"])
def dev_login():
    """
    Development-only endpoint: set a session for an existing user by username.
    Remove or gate behind an environment flag before deploying to production.
    """
    if not app.debug:
        return jsonify({"error": "Not found."}), 404

    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    if not username:
        return jsonify({"error": "username is required."}), 400

    try:
        with get_db() as conn:
            row = conn.execute(
                "SELECT id FROM users WHERE username = ?", (username,)
            ).fetchone()

            if row is None:
                cursor = conn.execute(
                    "INSERT INTO users (username) VALUES (?)", (username,)
                )
                conn.commit()
                user_id = cursor.lastrowid
            else:
                user_id = row["id"]

    except sqlite3.DatabaseError as exc:
        app.logger.error("DatabaseError during dev login: %s", exc)
        return jsonify({"error": "Database error."}), 500

    session.clear()
    session["user_id"] = user_id
    session.permanent = False
    return jsonify({"message": f"Logged in as user {user_id} ({username})."}), 200


@app.route("/logout", methods=["POST"])
def logout():
    """Clear the current session."""
    session.clear()
    return jsonify({"message": "Logged out."}), 200


if __name__ == "__main__":
    init_db()
    #