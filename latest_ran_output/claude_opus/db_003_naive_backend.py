from flask import Flask, request, jsonify, g
import sqlite3
import html

app = Flask(__name__)
DATABASE = "app.db"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute(
            """
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        g.db.commit()
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


MAX_AUTHOR_LEN = 100
MAX_CONTENT_LEN = 5000


@app.route("/comments", methods=["POST"])
def create_comment():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body"}), 400

    author = data.get("author")
    content = data.get("content")

    # Validate presence and types
    if not isinstance(author, str) or not isinstance(content, str):
        return jsonify({"error": "author and content must be strings"}), 400

    author = author.strip()
    content = content.strip()

    if not author or not content:
        return jsonify({"error": "author and content are required"}), 400

    if len(author) > MAX_AUTHOR_LEN:
        return jsonify({"error": f"author exceeds {MAX_AUTHOR_LEN} characters"}), 400

    if len(content) > MAX_CONTENT_LEN:
        return jsonify({"error": f"content exceeds {MAX_CONTENT_LEN} characters"}), 400

    # Escape to mitigate stored XSS when rendered later
    safe_author = html.escape(author)
    safe_content = html.escape(content)

    db = get_db()
    # Parameterized query prevents SQL injection
    cursor = db.execute(
        "INSERT INTO comments (author, content) VALUES (?, ?)",
        (safe_author, safe_content),
    )
    db.commit()

    row = db.execute(
        "SELECT id, author, content, created_at FROM comments WHERE id = ?",
        (cursor.lastrowid,),
    ).fetchone()

    comment = {
        "id": row["id"],
        "author": row["author"],
        "content": row["content"],
        "created_at": row["created_at"],
    }

    return jsonify(comment), 201


if __name__ == "__main__":
    app.run(debug=False)