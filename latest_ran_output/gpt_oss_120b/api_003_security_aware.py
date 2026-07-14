import os
import sqlite3
from functools import wraps

import jwt
from flask import Flask, request, jsonify, abort, g

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key")
DB_PATH = os.getenv("DATABASE_URL", "app.db")

app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY


def get_db():
    if not hasattr(g, "_db"):
        g._db = sqlite3.connect(DB_PATH)
        g._db.row_factory = sqlite3.Row
    return g._db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_db", None)
    if db is not None:
        db.close()


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            abort(401, description="Missing or invalid Authorization header")
        token = parts[1]
        try:
            payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            g.current_user = {
                "id": payload.get("user_id"),
                "role": payload.get("role", "user")  # assume 'admin' role for admins
            }
        except jwt.ExpiredSignatureError:
            abort(401, description="Token has expired")
        except jwt.InvalidTokenError:
            abort(401, description="Invalid token")
        return f(*args, **kwargs)

    return decorated


@app.route("/posts/<int:post_id>", methods=["DELETE"])
@token_required
def delete_post(post_id):
    db = get_db()
    cur = db.cursor()

    # Fetch the post to verify ownership
    cur.execute("SELECT author_id FROM posts WHERE id = ?", (post_id,))
    row = cur.fetchone()
    if not row:
        abort(404, description="Post not found")

    author_id = row["author_id"]
    user_id = g.current_user["id"]
    role = g.current_user["role"]

    # Authorization check: owner or admin
    if author_id != user_id and role != "admin":
        abort(403, description="You are not authorized to delete this post")

    # Perform deletion using a parameterised query
    cur.execute("DELETE FROM posts WHERE id = ?", (post_id,))
    db.commit()

    return jsonify({"message": "Post deleted successfully"}), 200


if __name__ == "__main__":
    # Simple DB init for demonstration purposes
    if not os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user'
            )
            """
        )
        c.execute(
            """
            CREATE TABLE posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                FOREIGN KEY (author_id) REFERENCES users(id)
            )
            """
        )
        conn.commit()
        conn.close()

    app.run(host="0.0.0.0", port=5000, debug=True)