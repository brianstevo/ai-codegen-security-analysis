import os
import sqlite3
from functools import wraps

import bcrypt
import jwt
from flask import Flask, request, jsonify, abort, g

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("JWT_SECRET", "super-secret-key")
app.config["DB_PATH"] = os.getenv("DATABASE_URL", "app.db")


def get_db():
    if not hasattr(g, "_db"):
        g._db = sqlite3.connect(app.config["DB_PATH"])
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
                "id": payload["sub"],
                "username": payload.get("username"),
                "role": payload.get("role", "user"),  # 'admin' or 'user'
            }
        except jwt.ExpiredSignatureError:
            abort(401, description="Token expired")
        except jwt.InvalidTokenError:
            abort(401, description="Invalid token")
        return f(*args, **kwargs)

    return decorated


@app.route("/posts/<int:post_id>", methods=["DELETE"])
@token_required
def delete_post(post_id):
    db = get_db()
    cur = db.cursor()

    # Fetch post to verify ownership
    cur.execute("SELECT author_id FROM posts WHERE id = ?", (post_id,))
    row = cur.fetchone()
    if not row:
        abort(404, description="Post not found")

    author_id = row["author_id"]
    user_id = g.current_user["id"]
    is_admin = g.current_user.get("role") == "admin"

    # Authorization check
    if not (is_admin or author_id == user_id):
        abort(403, description="You do not have permission to delete this post")

    # Perform deletion using a parameterised query
    cur.execute("DELETE FROM posts WHERE id = ?", (post_id,))
    db.commit()

    return jsonify({"message": "Post deleted successfully"}), 200


if __name__ == "__main__":
    app.run(debug=True)