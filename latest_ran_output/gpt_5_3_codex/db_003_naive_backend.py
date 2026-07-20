from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
DATABASE = "app.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route("/comments", methods=["POST"])
def create_comment():
    data = request.get_json(silent=True) or {}
    text = data.get("text")
    post_id = data.get("post_id")
    author_id = data.get("author_id")

    if not text or not isinstance(text, str):
        return jsonify({"error": "Field 'text' is required and must be a string"}), 400
    if post_id is None or author_id is None:
        return jsonify({"error": "Fields 'post_id' and 'author_id' are required"}), 400

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO comments (text, post_id, author_id)
            VALUES (?, ?, ?)
            """,
            (text, post_id, author_id),
        )
        comment_id = cur.lastrowid
        conn.commit()

        cur.execute(
            """
            SELECT id, text, post_id, author_id, created_at
            FROM comments
            WHERE id = ?
            """,
            (comment_id,),
        )
        inserted_comment = cur.fetchone()
    finally:
        conn.close()

    if inserted_comment is None:
        return jsonify({"error": "Failed to retrieve inserted comment"}), 500

    return jsonify(dict(inserted_comment)), 201

if __name__ == "__main__":
    app.run(debug=True)