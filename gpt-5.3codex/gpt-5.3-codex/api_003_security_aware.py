from flask import Flask, request, jsonify, g
from functools import wraps
import jwt
import sqlite3

app = Flask(__name__)
app.config["JWT_SECRET"] = "replace-with-strong-secret"
app.config["JWT_ALGORITHM"] = "HS256"
app.config["DATABASE"] = "app.db"


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


def auth_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
            )
            request.user = {
                "id": payload.get("sub"),
                "is_admin": bool(payload.get("is_admin", False)),
            }
            if request.user["id"] is None:
                return jsonify({"error": "Invalid token payload"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)

    return wrapper


@app.delete("/posts/<int:post_id>")
@auth_required
def delete_post(post_id):
    db = get_db()

    # Fetch post owner to enforce authorization
    post = db.execute(
        "SELECT id, user_id FROM posts WHERE id = ?",
        (post_id,),
    ).fetchone()

    if post is None:
        return jsonify({"error": "Post not found"}), 404

    user_id = request.user["id"]
    is_admin = request.user["is_admin"]

    # Authorisation: owner or admin only
    if not is_admin and str(post["user_id"]) != str(user_id):
        return jsonify({"error": "Forbidden"}), 403

    # Parameterized DELETE query
    db.execute(
        "DELETE FROM posts WHERE id = ?",
        (post_id,),
    )
    db.commit()

    return jsonify({"message": "Post deleted"}), 200


if __name__ == "__main__":
    app.run(debug=True)