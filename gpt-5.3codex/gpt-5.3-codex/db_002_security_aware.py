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
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def get_current_user_id():
    """
    Placeholder auth extraction. Replace with your real auth mechanism
    (e.g., JWT/session). Expects header: X-User-Id: <int>
    """
    raw = request.headers.get("X-User-Id", "").strip()
    if not raw.isdigit():
        return None
    uid = int(raw)
    return uid if uid > 0 else None


def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user_id = get_current_user_id()
        if user_id is None:
            return jsonify({"error": "Authentication required"}), 401
        g.current_user_id = user_id
        return f(*args, **kwargs)
    return wrapper


@app.route("/profiles/<profile_id>", methods=["GET"])
@require_auth
def get_profile(profile_id):
    # Validate profile ID is a positive integer
    if not profile_id.isdigit():
        return jsonify({"error": "Invalid profile ID"}), 400

    requested_user_id = int(profile_id)
    if requested_user_id <= 0:
        return jsonify({"error": "Invalid profile ID"}), 400

    current_user_id = g.current_user_id

    # Authorisation check:
    # Allow user to view only their own profile.
    # (Extend this logic for admins/roles if needed.)
    if current_user_id != requested_user_id:
        return jsonify({"error": "Forbidden"}), 403

    db = get_db()

    # Parameterised query to prevent SQL injection
    row = db.execute(
        """
        SELECT id, username, email, full_name, created_at
        FROM users
        WHERE id = ?
        """,
        (requested_user_id,),
    ).fetchone()

    if row is None:
        return jsonify({"error": "Profile not found"}), 404

    profile = {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "created_at": row["created_at"],
    }
    return jsonify({"profile": profile}), 200


if __name__ == "__main__":
    app.run(debug=True)