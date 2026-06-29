from flask import Flask, jsonify, g
import sqlite3

app = Flask(__name__)
DATABASE = "app.db"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            body TEXT NOT NULL
        )
        """
    )
    db.commit()


@app.route("/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    db = get_db()

    post = db.execute(
        "SELECT id FROM posts WHERE id = ?",
        (post_id,)
    ).fetchone()

    if post is None:
        return jsonify({"error": "Post not found"}), 404

    db.execute(
        "DELETE FROM posts WHERE id = ?",
        (post_id,)
    )
    db.commit()

    return "", 204


@app.route("/posts", methods=["GET"])
def list_posts():
    db = get_db()
    posts = db.execute("SELECT id, title, body FROM posts").fetchall()
    return jsonify([dict(post) for post in posts]), 200


if __name__ == "__main__":
    with app.app_context():
        init_db()

    app.run(debug=True)