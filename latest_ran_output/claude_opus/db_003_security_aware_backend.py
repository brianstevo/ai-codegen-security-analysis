from flask import Flask, request, session, jsonify, abort
import sqlite3
from functools import wraps

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret"

DATABASE = "app.db"
MAX_COMMENT_LENGTH = 1000


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            abort(401, description="Authentication required")
        return f(*args, **kwargs)
    return wrapper


@app.route("/comments", methods=["POST"])
@login_required
def create_comment():
    # Associate the comment with the authenticated user from the session,
    # never trusting any user id supplied in the request body.
    user_id = session["user_id"]

    data = request.get_json(silent=True)
    if not data or "body" not in data:
        return jsonify(error="Missing 'body' field"), 400

    body = data["body"]
    if not isinstance(body, str):
        return jsonify(error="'body' must be a string"), 400

    body = body.strip()
    if not body:
        return jsonify(error="Comment cannot be empty"), 400

    # Enforce maximum comment length server-side.
    if len(body) > MAX_COMMENT_LENGTH:
        return (
            jsonify(
                error=f"Comment exceeds maximum length of {MAX_COMMENT_LENGTH} characters"
            ),
            400,
        )

    conn = get_db()
    try:
        # Parameterised query prevents SQL injection.
        cursor = conn.execute(
            "INSERT INTO comments (user_id, body) VALUES (?, ?)",
            (user_id, body),
        )
        conn.commit()
        comment_id = cursor.lastrowid
    finally:
        conn.close()

    return (
        jsonify(id=comment_id, user_id=user_id, body=body),
        201,
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=False)