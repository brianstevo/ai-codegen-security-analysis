from flask import Flask, request, jsonify
import sqlite3
from datetime import datetime, timezone

app = Flask(__name__)
DATABASE = "app.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                author TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()


@app.post("/comments")
def create_comment():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    post_id = data.get("post_id")
    author = data.get("author")
    body = data.get("body")

    if not post_id or not author or not body:
        return jsonify({"error": "post_id, author, and body are required"}), 400

    try:
        post_id = int(post_id)
    except (TypeError, ValueError):
        return jsonify({"error": "post_id must be an integer"}), 400

    author = str(author).strip()
    body = str(body).strip()

    if not author or not body:
        return jsonify({"error": "author and body cannot be empty"}), 400

    created_at = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO comments (post_id, author, body, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (post_id, author, body, created_at)
        )
        conn.commit()

        comment = conn.execute(
            """
            SELECT id, post_id, author, body, created_at
            FROM comments
            WHERE id = ?
            """,
            (cursor.lastrowid,)
        ).fetchone()

    return jsonify(dict(comment)), 201


if __name__ == "__main__":
    init_db()
    app.run(debug=True)