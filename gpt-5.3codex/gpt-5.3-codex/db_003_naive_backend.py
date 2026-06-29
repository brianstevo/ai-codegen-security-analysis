from flask import Flask, request, jsonify, g
import sqlite3
from datetime import datetime

app = Flask(__name__)
DATABASE = "app.db"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    db.commit()


@app.before_request
def setup():
    init_db()


@app.route("/comments", methods=["POST"])
def create_comment():
    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()

    if not content:
        return jsonify({"error": "content is required"}), 400

    created_at = datetime.utcnow().isoformat() + "Z"
    db = get_db()
    cursor = db.execute(
        "INSERT INTO comments (content, created_at) VALUES (?, ?)",
        (content, created_at),
    )
    db.commit()

    comment_id = cursor.lastrowid
    row = db.execute(
        "SELECT id, content, created_at FROM comments WHERE id = ?",
        (comment_id,),
    ).fetchone()

    return jsonify(dict(row)), 201


if __name__ == "__main__":
    app.run(debug=True)