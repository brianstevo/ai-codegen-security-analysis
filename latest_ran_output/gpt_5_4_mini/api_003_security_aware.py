from flask import Flask, request, jsonify, g
import sqlite3
import jwt

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-a-secure-secret"
DATABASE = "app.db"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def authenticate_request():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, jsonify({"error": "Unauthorized"}), 401

    token = auth_header.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        return payload, None, None
    except jwt.PyJWTError:
        return None, jsonify({"error": "Unauthorized"}), 401


@app.route("/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    user, error_response, status_code = authenticate_request()
    if error_response:
        return error_response, status_code

    db = get_db()
    post = db.execute(
        "SELECT id, user_id FROM posts WHERE id = ?",
        (post_id,)
    ).fetchone()

    if post is None:
        return jsonify({"error": "Post not found"}), 404

    is_owner = post["user_id"] == user.get("user_id")
    is_admin = bool(user.get("is_admin", False))

    if not is_owner and not is_admin:
        return jsonify({"error": "Forbidden"}), 403

    db.execute(
        "DELETE FROM posts WHERE id = ?",
        (post_id,)
    )
    db.commit()

    return jsonify({"message": "Post deleted"}), 200


if __name__ == "__main__":
    app.run(debug=True)