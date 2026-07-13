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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author TEXT,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


@app.route("/comments", methods=["POST"])
def create_comment():
    data = request.get_json(silent=True) or {}

    author = data.get("author")
    body = data.get("body")

    if not body or not isinstance(body, str):
        return jsonify({"error": "Comment body is required"}), 400

    if author is not None and not isinstance(author, str):
        return jsonify({"error": "Author must be a string"}), 400

    body = body.strip()
    author = author.strip() if isinstance(author, str) else None

    if not body:
        return jsonify({"error": "Comment body cannot be empty"}), 400

    created_at = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO comments (author, body, created_at)
            VALUES (?, ?, ?)
            """,
            (author, body, created_at),
        )
        conn.commit()

        comment = conn.execute(
            """
            SELECT id, author, body, created_at
            FROM comments
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()

    return jsonify(dict(comment)), 201


if __name__ == "__main__":
    init_db()
    app.run(debug=True)