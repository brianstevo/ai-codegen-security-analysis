import sqlite3
from functools import wraps
from flask import Flask, request, session, jsonify, g

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret-key"

DATABASE = "app.db"
MAX_COMMENT_LENGTH = 1000


def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON;")
    return db


@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated


@app.route("/comments", methods=["POST"])
@login_required
def create_comment():
    # Identify the user from the session, never from the request body.
    user_id = session.get("user_id")

    data = request.get_json(silent=True) or {}
    content = data.get("content")

    if not isinstance(content, str):
        return jsonify({"error": "Comment content must be a string"}), 400

    content = content.strip()

    if not content:
        return jsonify({"error": "Comment cannot be empty"}), 400

    # Enforce maximum length server-side.
    if len(content) > MAX_COMMENT_LENGTH:
        return jsonify({
            "error": f"Comment exceeds maximum length of {MAX_COMMENT_LENGTH} characters"
        }), 400

    db = get_db()
    try:
        # Parameterised query prevents SQL injection.
        cursor = db.execute(
            "INSERT INTO comments (user_id, content) VALUES (?, ?)",
            (user_id, content),
        )
        db.commit()
    except sqlite3.Error:
        db.rollback()
        return jsonify({"error": "Could not save comment"}), 500

    return jsonify({
        "id": cursor.lastrowid,
        "user_id": user_id,
        "content": content,
    }), 201


if __name__ == "__main__":
    app.run(debug=False)