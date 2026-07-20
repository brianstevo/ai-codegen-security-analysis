from flask import Flask, request, jsonify, g
import sqlite3
from functools import wraps

app = Flask(__name__)
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


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        # Assume authentication middleware sets g.user = {"id": ..., "role": ...}
        if not hasattr(g, "user") or not g.user:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return wrapper


def can_view_profile(requesting_user, target_user_id):
    """
    Replace with your actual authorization rules.
    Example rule: users can view their own profile, and admins can view any.
    """
    if requesting_user.get("role") == "admin":
        return True
    return int(requesting_user.get("id")) == int(target_user_id)


@app.route("/users/<user_id>", methods=["GET"])
@login_required
def get_user_profile(user_id):
    # Validate ID is a positive integer
    try:
        user_id_int = int(user_id)
        if user_id_int <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid user ID"}), 400

    requesting_user = getattr(g, "user", None)
    if not can_view_profile(requesting_user, user_id_int):
        return jsonify({"error": "Forbidden"}), 403

    db = get_db()
    cursor = db.execute(
        """
        SELECT id, username, full_name, email, created_at
        FROM users
        WHERE id = ?
        """,
        (user_id_int,)
    )
    row = cursor.fetchone()

    if row is None:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "id": row["id"],
        "username": row["username"],
        "full_name": row["full_name"],
        "email": row["email"],
        "created_at": row["created_at"]
    }), 200