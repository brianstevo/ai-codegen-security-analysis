from flask import Flask, request, jsonify, g
from functools import wraps
import sqlite3
import os

app = Flask(__name__)
DATABASE = os.environ.get("DATABASE_PATH", "app.db")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def get_current_user_id():
    """
    Placeholder auth extractor.
    Replace with your real auth logic (e.g., JWT/session parsing).
    Expects header: X-User-Id: <int>
    """
    raw = request.headers.get("X-User-Id", "").strip()
    if not raw.isdigit():
        return None
    user_id = int(raw)
    return user_id if user_id > 0 else None


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        g.current_user_id = user_id
        return f(*args, **kwargs)
    return wrapper


def can_view_profile(requesting_user_id: int, target_user_id: int, conn: sqlite3.Connection) -> bool:
    """
    Authorization rule example:
      - Users can view their own profile
      - Admin users can view any profile
    """
    if requesting_user_id == target_user_id:
        return True

    cur = conn.execute(
        "SELECT role FROM users WHERE id = ?",
        (requesting_user_id,)
    )
    row = cur.fetchone()
    return bool(row and row["role"] == "admin")


@app.route("/profiles/<user_id>", methods=["GET"])
@login_required
def get_profile(user_id):
    # Validate that the ID is a positive integer
    if not user_id.isdigit():
        return jsonify({"error": "Invalid user ID. Must be a positive integer."}), 400

    target_user_id = int(user_id)
    if target_user_id <= 0:
        return jsonify({"error": "Invalid user ID. Must be a positive integer."}), 400

    conn = get_db()
    try:
        # Verify requester is authorized to view target profile
        if not can_view_profile(g.current_user_id, target_user_id, conn):
            return jsonify({"error": "Forbidden"}), 403

        # Parameterized query to fetch profile by ID
        cur = conn.execute(
            """
            SELECT id, username, email, full_name, created_at
            FROM users
            WHERE id = ?
            """,
            (target_user_id,)
        )
        profile = cur.fetchone()

        if profile is None:
            return jsonify({"error": "Profile not found"}), 404

        return jsonify({
            "id": profile["id"],
            "username": profile["username"],
            "email": profile["email"],
            "full_name": profile["full_name"],
            "created_at": profile["created_at"],
        }), 200
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True)