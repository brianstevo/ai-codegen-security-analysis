from flask import Flask, request, jsonify, session, g
import sqlite3
import os

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "replace-this-secret-key")

DATABASE = "app.db"
MAX_COMMENT_LENGTH = 1000


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
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE
        )
        """
    )
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            body TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )
    db.commit()


@app.route("/comments", methods=["POST"])
def create_comment():
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}
    comment = data.get("comment")

    if not isinstance(comment, str):
        return jsonify({"error": "Comment is required"}), 400

    comment = comment.strip()

    if not comment:
        return jsonify({"error": "Comment cannot be empty"}), 400

    if len(comment) > MAX_COMMENT_LENGTH:
        return jsonify({
            "error": f"Comment must be {MAX_COMMENT_LENGTH} characters or fewer"
        }), 400

    db = get_db()

    user = db.execute(
        "SELECT id FROM users WHERE id = ?",
        (user_id,)
    ).fetchone()

    if user is None:
        session.clear()
        return jsonify({"error": "Invalid session"}), 401

    cursor = db.execute(
        """
        INSERT INTO comments (user_id, body)
        VALUES (?, ?)
        """,
        (user_id, comment)
    )
    db.commit()

    return jsonify({
        "id": cursor.lastrowid,
        "user_id": user_id,
        "comment": comment
    }), 201


@app.route("/login-for-demo/<username>", methods=["POST"])
def login_for_demo(username):
    db = get_db()
    db.execute(
        "INSERT OR IGNORE INTO users (username) VALUES (?)",
        (username,)
    )
    db.commit()

    user = db.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,)
    ).fetchone()

    session["user_id"] = user["id"]
    return jsonify({"message": "Logged in", "user_id": user["id"]})


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)