from flask import Flask, request, session, jsonify, g
import sqlite3
from datetime import datetime

app = Flask(__name__)
app.secret_key = "change-me"

DATABASE = "app.db"
MAX_COMMENT_LENGTH = 500


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


@app.route("/comments", methods=["POST"])
def create_comment():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "authentication required"}), 401

    data = request.get_json(silent=True) or {}
    content = data.get("content", "")

    if not isinstance(content, str):
        return jsonify({"error": "content must be a string"}), 400

    content = content.strip()
    if not content:
        return jsonify({"error": "content is required"}), 400

    if len(content) > MAX_COMMENT_LENGTH:
        return jsonify({"error": f"content exceeds maximum length of {MAX_COMMENT_LENGTH} characters"}), 400

    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO comments (user_id, content, created_at)
        VALUES (?, ?, ?)
        """,
        (user_id, content, datetime.utcnow().isoformat(timespec="seconds") + "Z"),
    )
    db.commit()

    return jsonify({
        "id": cursor.lastrowid,
        "user_id": user_id,
        "content": content,
        "message": "comment created"
    }), 201