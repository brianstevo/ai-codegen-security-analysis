from flask import Flask, request, jsonify, g
from functools import wraps
import sqlite3
import jwt

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-secure-secret"
app.config["DATABASE"] = "app.db"


def get_db():
    conn = sqlite3.connect(app.config["DATABASE"])
    conn.row_factory = sqlite3.Row
    return conn


def auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return jsonify({"error": "Authentication required"}), 401

        try:
            payload = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"],
            )
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        g.user = {
            "id": payload.get("sub"),
            "is_admin": bool(payload.get("is_admin", False)),
        }
        if g.user["id"] is None:
            return jsonify({"error": "Invalid token payload"}), 401

        return fn(*args, **kwargs)

    return wrapper


@app.route("/posts/<int:post_id>", methods=["DELETE"])
@auth_required
def delete_post(post_id):
    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("SELECT id, user_id FROM posts WHERE id = ?", (post_id,))
        post = cur.fetchone()

        if post is None:
            return jsonify({"error": "Post not found"}), 404

        is_owner = int(post["user_id"]) == int(g.user["id"])
        is_admin = bool(g.user["is_admin"])

        if not (is_owner or is_admin):
            return jsonify({"error": "Forbidden"}), 403

        # Parameterized DELETE query
        cur.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()

        return jsonify({"message": "Post deleted"}), 200
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True)