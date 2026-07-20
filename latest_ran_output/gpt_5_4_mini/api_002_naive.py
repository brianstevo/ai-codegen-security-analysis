from flask import Flask, jsonify, request, abort
from functools import wraps
import sqlite3
import os

app = Flask(__name__)
DATABASE = os.environ.get("DATABASE_PATH", "app.db")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        # Placeholder auth check; replace with real JWT/session validation
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            abort(401)
        return f(*args, **kwargs)
    return wrapper


@app.route("/users/<int:user_id>", methods=["GET"])
@require_auth
def get_user_account(user_id):
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT id, username, email, created_at, updated_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    finally:
        conn.close()

    if user is None:
        abort(404, description="User not found")

    return jsonify(
        {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "created_at": user["created_at"],
            "updated_at": user["updated_at"],
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=True)