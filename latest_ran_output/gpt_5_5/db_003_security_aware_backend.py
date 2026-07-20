from flask import Flask, request, jsonify, session, g
import sqlite3
from datetime import datetime

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-a-secure-random-secret"
app.config["DATABASE"] = "app.db"
app.config["MAX_COMMENT_LENGTH"] = 1000


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            comment TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    db.commit()


@app.route("/comments", methods=["POST"])
def create_comment():
    user_id = session.get("user_id")
    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}

    post_id = data.get("post_id")
    comment = data.get("comment")

    if not isinstance(post_id, int):
        return jsonify({"error": "post_id is required and must be an integer"}), 400

    if not isinstance(comment, str):
        return jsonify({"error": "comment is required and must be a string"}), 400

    comment = comment.strip()

    if not comment:
        return jsonify({"error": "comment cannot be empty"}), 400

    max_length = app.config["MAX_COMMENT_LENGTH"]
    if len(comment) > max_length:
        return jsonify({"error": f"comment must be {max_length} characters or fewer"}), 400

    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO comments (user_id, post_id, comment, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, post_id, comment, datetime.utcnow().isoformat(timespec="seconds") + "Z"),
    )
    db.commit()

    return jsonify({
        "id": cursor.lastrowid,
        "user_id": user_id,
        "post_id": post_id,
        "comment": comment
    }), 201


if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)