import os
import sqlite3
from functools import wraps

import jwt
from flask import Flask, g, jsonify, request

app = Flask(__name__)

DATABASE = os.environ.get("DATABASE_PATH", "app.db")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-this-secret")
JWT_ALGORITHM = "HS256"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
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
            return jsonify({"error": "Authentication required"}), 401

        token = auth_header.removeprefix("Bearer ").strip()

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        user_id = payload.get("sub")
        if user_id is None:
            return jsonify({"error": "Invalid token"}), 401

        db = get_db()
        user = db.execute(
            "SELECT id, username, is_admin FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if user is None:
            return jsonify({"error": "User not found"}), 401

        g.current_user = user
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

    is_owner = post["author_id"] == g.current_user["id"]
    is_admin = bool(g.current_user["is_admin"])

    if not is_owner and not is_admin:
        return jsonify({"error": "Forbidden"}), 403

    db.execute(
        "DELETE FROM posts WHERE id = ?",
        (post_id,),
    )
    db.commit()

    return jsonify({"message": "Post deleted"}), 200


if __name__ == "__main__":
    app.run(debug=False)