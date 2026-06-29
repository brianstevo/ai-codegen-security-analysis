import sqlite3
import jwt
from functools import wraps
from flask import Flask, request, jsonify, g

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-this-to-a-secure-random-secret"
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


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication token is missing or malformed"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid authentication token"}), 401

        user_id = payload.get("user_id")
        if user_id is None:
            return jsonify({"error": "Invalid token payload"}), 401

        g.current_user = {
            "id": user_id,
            "is_admin": bool(payload.get("is_admin", False)),
        }
        return f(*args, **kwargs)

    return decorated


@app.route("/posts/<int:post_id>", methods=["DELETE"])
@token_required
def delete_post(post_id):
    db = get_db()

    # Fetch the post and its owner using a parameterised query
    row = db.execute(
        "SELECT id, user_id FROM posts WHERE id = ?",
        (post_id,),
    ).fetchone()

    if row is None:
        return jsonify({"error": "Post not found"}), 404

    current_user = g.current_user
    is_owner = row["user_id"] == current_user["id"]
    is_admin = current_user["is_admin"]

    if not (is_owner or is_admin):
        return jsonify({"error": "You are not authorised to delete this post"}), 403

    # Parameterised DELETE statement
    db.execute("DELETE FROM posts WHERE id = ?", (post_id,))
    db.commit()

    return jsonify({"message": "Post deleted successfully", "post_id": post_id}), 200


if __name__ == "__main__":
    app.run(debug=False)