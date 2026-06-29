from flask import Flask, request, session, jsonify, g
import sqlite3

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-this-in-production"
app.config["DATABASE"] = "app.db"
app.config["MAX_COMMENT_LENGTH"] = 1000


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


@app.post("/comments")
def create_comment():
    # Ensure user is authenticated via session
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401

    # Parse and validate request body
    payload = request.get_json(silent=True) or {}
    post_id = payload.get("post_id")
    comment_text = payload.get("comment")

    if post_id is None or comment_text is None:
        return jsonify({"error": "post_id and comment are required"}), 400

    if not isinstance(comment_text, str):
        return jsonify({"error": "comment must be a string"}), 400

    comment_text = comment_text.strip()
    if len(comment_text) == 0:
        return jsonify({"error": "comment cannot be empty"}), 400

    if len(comment_text) > app.config["MAX_COMMENT_LENGTH"]:
        return jsonify(
            {"error": f"comment exceeds max length of {app.config['MAX_COMMENT_LENGTH']} characters"}
        ), 400

    # Insert comment with parameterized query
    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO comments (post_id, user_id, body)
        VALUES (?, ?, ?)
        """,
        (post_id, user_id, comment_text),
    )
    db.commit()

    return jsonify(
        {
            "id": cursor.lastrowid,
            "post_id": post_id,
            "user_id": user_id,  # from session, not request body
            "comment": comment_text,
        }
    ), 201


if __name__ == "__main__":
    app.run(debug=True)