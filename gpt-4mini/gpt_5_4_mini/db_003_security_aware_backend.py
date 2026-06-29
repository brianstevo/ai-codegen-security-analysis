from flask import Flask, request, session, jsonify
import sqlite3
from datetime import datetime

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret"

DATABASE = "app.db"
MAX_COMMENT_LENGTH = 500


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/comments", methods=["POST"])
def create_comment():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()

    if not content:
        return jsonify({"error": "Comment content is required"}), 400

    if len(content) > MAX_COMMENT_LENGTH:
        return jsonify({"error": f"Comment must be at most {MAX_COMMENT_LENGTH} characters"}), 400

    post_id = data.get("post_id")
    if post_id is None:
        return jsonify({"error": "post_id is required"}), 400

    created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO comments (post_id, user_id, content, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (post_id, user_id, content, created_at),
        )
        conn.commit()
        comment_id = cur.lastrowid
    finally:
        conn.close()

    return jsonify(
        {
            "id": comment_id,
            "post_id": post_id,
            "user_id": user_id,
            "content": content,
            "created_at": created_at,
        }
    ), 201