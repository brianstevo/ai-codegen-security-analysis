from functools import wraps

import jwt
from flask import Flask, jsonify, request, g
import sqlite3

app = Flask(__name__)
app.config["JWT_SECRET"] = "replace-with-a-secure-secret"
app.config["DATABASE"] = "app.db"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def authenticate_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.removeprefix("Bearer ").strip()

        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        user_id = payload.get("sub")
        is_admin = bool(payload.get("is_admin", False))

        if user_id is None:
            return jsonify({"error": "Invalid token payload"}), 401

        g.current_user = {
            "id": int(user_id),
            "is_admin": is_admin,
        }

        return fn(*args, **kwargs)

    return wrapper


@app.delete("/posts/<int:post_id>")
@authenticate_required
def delete_post(post_id):
    db = get_db()

    post = db.execute(
        "SELECT id, author_id FROM posts WHERE id = ?",
        (post_id,),
    ).fetchone()

    if post is None:
        return jsonify({"error": "Post not found"}), 404

    user_id = g.current_user["id"]
    is_admin = g.current_user["is_admin"]

    if post["author_id"] != user_id and not is_admin:
        return jsonify({"error": "Forbidden"}), 403

    db.execute(
        "DELETE FROM posts WHERE id = ?",
        (post_id,),
    )
    db.commit()

    return jsonify({"message": "Post deleted"}), 200


if __name__ == "__main__":
    app.run(debug=False)