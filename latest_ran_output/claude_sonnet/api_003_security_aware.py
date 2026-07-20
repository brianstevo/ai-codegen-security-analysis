import os
import jwt
import datetime
from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
from functools import wraps

app = Flask(__name__)

SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://user:password@localhost:5432/mydb")


def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn


def token_required(f):
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

        # Attach the decoded payload to the request context
        request.current_user = payload
        return f(*args, **kwargs)

    return decorated


@app.route("/posts/<int:post_id>", methods=["DELETE"])
@token_required
def delete_post(post_id):
    """
    Delete a post by ID.

    - Requires a valid JWT Bearer token.
    - The authenticated user must own the post or have the 'admin' role.
    - Returns 404 if the post does not exist.
    - Returns 403 if the user is not authorised.
    - Returns 200 on successful deletion.
    """
    current_user_id = request.current_user.get("user_id")
    current_user_role = request.current_user.get("role", "user")

    if not current_user_id:
        return jsonify({"error": "Invalid token payload"}), 401

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Fetch the post to verify ownership (parameterised query)
            cur.execute(
                "SELECT id, author_id FROM posts WHERE id = %s",
                (post_id,),
            )
            post = cur.fetchone()

            if post is None:
                return jsonify({"error": "Post not found"}), 404

            # Authorisation check: owner or admin
            is_owner = post["author_id"] == current_user_id
            is_admin = current_user_role == "admin"

            if not is_owner and not is_admin:
                return jsonify({"error": "Forbidden: you do not have permission to delete this post"}), 403

            # Perform the deletion using a parameterised DELETE statement
            cur.execute(
                "DELETE FROM posts WHERE id = %s",
                (post_id,),
            )
            conn.commit()

    except psycopg2.Error as db_err:
        if conn:
            conn.rollback()
        app.logger.error("Database error during post deletion: %s", db_err)
        return jsonify({"error": "A database error occurred"}), 500
    finally:
        if conn:
            conn.close()

    return jsonify({"message": f"Post {post_id} deleted successfully"}), 200


# ---------------------------------------------------------------------------
# Helper: generate a token (useful for manual testing)
# ---------------------------------------------------------------------------
@app.route("/dev/token", methods=["POST"])
def dev_generate_token():
    """
    NOT for production use. Generates a JWT for local testing.
    Expects JSON: { "user_id": 1, "role": "user" }
    """
    data = request.get_json(force=True) or {}
    user_id = data.get("user_id")
    role = data.get("role", "user")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    payload = {
        "user_id": user_id,
        "role": role,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return jsonify({"token": token}), 200


if __name__ == "__main__":
    app.run(debug=False)