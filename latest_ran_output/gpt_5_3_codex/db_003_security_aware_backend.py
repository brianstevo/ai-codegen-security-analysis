from flask import Flask, request, session, jsonify, g
import sqlite3

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-a-secure-random-secret"
app.config["DATABASE"] = "app.db"

MAX_COMMENT_LENGTH = 1000


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
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
        return jsonify({"error": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}
    post_id = data.get("post_id")
    comment = data.get("comment")

    if post_id is None:
        return jsonify({"error": "post_id is required"}), 400

    try:
        post_id = int(post_id)
    except (TypeError, ValueError):
        return jsonify({"error": "post_id must be an integer"}), 400

    if not isinstance(comment, str):
        return jsonify({"error": "comment must be a string"}), 400

    comment = comment.strip()
    if not comment:
        return jsonify({"error": "comment cannot be empty"}), 400

    if len(comment) > MAX_COMMENT_LENGTH:
        return jsonify(
            {"error": f"comment exceeds maximum length of {MAX_COMMENT_LENGTH} characters"}
        ), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        """
        INSERT INTO comments (post_id, user_id, comment_text)
        VALUES (?, ?, ?)
        """,
        (post_id, user_id, comment),
    )
    db.commit()

    return jsonify(
        {
            "message": "Comment created",
            "comment_id": cursor.lastrowid,
            "post_id": post_id,
            "user_id": user_id,
        }
    ), 201


if __name__ == "__main__":
    app.run(debug=True)