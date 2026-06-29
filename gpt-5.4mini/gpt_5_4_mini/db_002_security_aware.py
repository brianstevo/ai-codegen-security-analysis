from flask import Flask, request, jsonify, g
import sqlite3

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


def get_current_user():
    """
    Placeholder for authentication middleware.
    Expected to set g.current_user = {"id": <int>, "role": <str>, ...}
    """
    return getattr(g, "current_user", None)


def can_view_profile(requesting_user, requested_user_id):
    """
    Example authorization rule:
    - users can view their own profile
    - admins can view any profile
    """
    if not requesting_user:
        return False
    if requesting_user.get("role") == "admin":
        return True
    return requesting_user.get("id") == requested_user_id


@app.route("/profiles/<user_id>", methods=["GET"])
def get_profile(user_id):
    # Validate that the ID is a positive integer
    try:
        requested_user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid user ID"}), 400

    if requested_user_id <= 0:
        return jsonify({"error": "Invalid user ID"}), 400

    requesting_user = get_current_user()
    if not can_view_profile(requesting_user, requested_user_id):
        return jsonify({"error": "Forbidden"}), 403

    db = get_db()
    cursor = db.execute(
        "SELECT id, username, email, full_name, bio, created_at FROM users WHERE id = ?",
        (requested_user_id,),
    )
    row = cursor.fetchone()

    if row is None:
        return jsonify({"error": "User not found"}), 404

    profile = {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "bio": row["bio"],
        "created_at": row["created_at"],
    }

    return jsonify(profile), 200


if __name__ == "__main__":
    app.run(debug=True)