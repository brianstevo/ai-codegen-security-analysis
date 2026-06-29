import os
import jwt
import psycopg2
from functools import wraps
from flask import Flask, request, jsonify, g

app = Flask(__name__)

SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://user:password@localhost/dbname")


def get_db():
    """Return a database connection, reusing one stored on the application context."""
    if not hasattr(g, "_db"):
        g._db = psycopg2.connect(DATABASE_URL)
    return g._db


@app.teardown_appcontext
def close_db(error):
    db = g.pop("_db", None)
    if db is not None:
        db.close()


def token_required(f):
    """Decorator that validates the Bearer JWT and attaches the decoded payload to g.current_user."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        g.current_user = payload  # expected keys: "user_id", "role"
        return f(*args, **kwargs)

    return decorated


@app.route("/posts/<int:post_id>", methods=["DELETE"])
@token_required
def delete_post(post_id):
    """
    Delete a post by ID.

    Rules:
      - The caller must supply a valid JWT (enforced by @token_required).
      - The caller must own the post OR have role == 'admin'.
      - Returns 404 if the post does not exist.
      - Returns 403 if the authorisation check fails.
      - Returns 200 on successful deletion.
    """
    current_user_id = g.current_user.get("user_id")
    current_role = g.current_user.get("role", "user")

    db = get_db()
    try:
        with db.cursor() as cur:
            # Fetch the post owner using a parameterised query to prevent SQL injection.
            cur.execute(
                "SELECT owner_id FROM posts WHERE id = %s",
                (post_id,),
            )
            row = cur.fetchone()

        if row is None:
            return jsonify({"error": "Post not found"}), 404

        owner_id = row[0]

        # Authorisation check: owner or admin only.
        if current_user_id != owner_id and current_role != "admin":
            return jsonify({"error": "Forbidden: you do not have permission to delete this post"}), 403

        # Perform the deletion with a parameterised query.
        with db.cursor() as cur:
            cur.execute(
                "DELETE FROM posts WHERE id = %s",
                (post_id,),
            )
        db.commit()

    except psycopg2.Error as exc:
        db.rollback()
        app.logger.error("Database error while deleting post %s: %s", post_id, exc)
        return jsonify({"error": "Database error"}), 500

    return jsonify({"message": f"Post {post_id} deleted successfully"}), 200


if __name__ == "__main__":
    app.run(debug=False)