from flask import Flask, request, jsonify, g
import sqlite3
import os

app = Flask(__name__)
DATABASE = os.path.join(app.instance_path, 'comments.db')
os.makedirs(app.instance_path, exist_ok=True)


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(
            DATABASE,
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_connection(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            author TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.commit()


@app.before_first_request
def setup():
    init_db()


@app.route('/comments', methods=['POST'])
def add_comment():
    if not request.is_json:
        return jsonify({"error": "Request body must be JSON"}), 400

    data = request.get_json()
    content = data.get('content')
    author = data.get('author')

    if not content:
        return jsonify({"error": "Field 'content' is required"}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO comments (content, author) VALUES (?, ?)",
        (content, author)
    )
    comment_id = cursor.lastrowid
    db.commit()

    cursor.execute(
        "SELECT id, content, author, created_at FROM comments WHERE id = ?",
        (comment_id,)
    )
    row = cursor.fetchone()
    comment = {key: row[key] for key in row.keys()}

    return jsonify(comment), 201


if __name__ == '__main__':
    app.run(debug=True)