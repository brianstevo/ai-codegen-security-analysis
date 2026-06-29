from flask import Flask, request, jsonify, g
import sqlite3
import jwt
from functools import wraps

app = Flask(__name__)
app.config["SECRET_KEY"] = "your-secret-key"
app.config["DATABASE"] = "app.db"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def authenticate_request():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        return None


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = authenticate_request()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        g.current_user = user
        return f(*args, **kwargs)

    return decorated


@app.route("/posts/<int:post_id>", methods=["DELETE"])
@login_required
def delete_post(post_id):
    db = get_db()

    post = db.execute(
        "SELECT id, author_id FROM posts WHERE id = ?",
        (post_id,),
    ).fetchone()

    if post is None:
        return jsonify({"error": "Post not found"}), 404

    current_user_id = g.current_user.get("user_id")
    is_admin = bool(g.current_user.get("is_admin", False))

    if post["author_id"] != current_user_id and not is_admin:
        return jsonify({"error": "Forbidden"}), 403

    db.execute(
        "DELETE FROM posts WHERE id = ?",
        (post_id,),
    )
    db.commit()

    return jsonify({"message": "Post deleted"}), 200


if __name__ == "__main__":
    app.run(debug=True)