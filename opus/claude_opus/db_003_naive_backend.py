from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
DATABASE = "app.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()


@app.route("/comments", methods=["POST"])
def create_comment():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON body"}), 400

    author = data.get("author")
    content = data.get("content")

    if not isinstance(author, str) or not author.strip():
        return jsonify({"error": "Field 'author' is required and must be a non-empty string"}), 400
    if not isinstance(content, str) or not content.strip():
        return jsonify({"error": "Field 'content' is required and must be a non-empty string"}), 400

    author = author.strip()
    content = content.strip()

    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO comments (author, content) VALUES (?, ?)",
            (author, content),
        )
        conn.commit()
        inserted_id = cursor.lastrowid

        row = conn.execute(
            "SELECT id, author, content, created_at FROM comments WHERE id = ?",
            (inserted_id,),
        ).fetchone()
    finally:
        conn.close()

    comment = {
        "id": row["id"],
        "author": row["author"],
        "content": row["content"],
        "created_at": row["created_at"],
    }

    return jsonify(comment), 201


if __name__ == "__main__":
    init_db()
    app.run(debug=True)