from flask import Flask, request, jsonify, g
from functools import wraps
import sqlite3
import re

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


def init_db():
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            first_name TEXT,
            last_name TEXT,
            bio TEXT
        )
        """
    )
    db.commit()


def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Replace this with real auth logic (JWT/session/etc.)
        # For demo purposes, read user id from header.
        user_id = request.headers.get("X-User-Id")
        if not user_id or not str(user_id).isdigit():
            return jsonify({"error": "Unauthorized"}), 401
        g.current_user_id = int(user_id)
        return f(*args, **kwargs)

    return decorated


def valid_email(email: str) -> bool:
    if not isinstance(email, str):
        return False
    pattern = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
    return re.match(pattern, email) is not None


@app.route("/api/profile", methods=["PUT"])
@auth_required
def update_profile():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON body"}), 400

    allowed_fields = {"username", "email", "first_name", "last_name", "bio"}
    updates = {}
    errors = {}

    for field in allowed_fields:
        if field in data:
            value = data[field]
            if value is None:
                updates[field] = None
                continue
            if not isinstance(value, str):
                errors[field] = "Must be a string or null"
                continue

            value = value.strip()

            if field in {"username", "email"} and value == "":
                errors[field] = "Cannot be empty"
                continue
            if field == "username" and len(value) < 3:
                errors[field] = "Must be at least 3 characters"
                continue
            if field == "email" and not valid_email(value):
                errors[field] = "Invalid email format"
                continue
            if field in {"first_name", "last_name"} and len(value) > 50:
                errors[field] = "Must be 50 characters or fewer"
                continue
            if field == "bio" and len(value) > 500:
                errors[field] = "Must be 500 characters or fewer"
                continue

            updates[field] = value

    if errors:
        return jsonify({"error": "Validation failed", "fields": errors}), 400

    if not updates:
        return jsonify({"error": "No valid fields provided to update"}), 400

    db = get_db()

    # Ensure user exists
    user = db.execute(
        "SELECT id FROM users WHERE id = ?",
        (g.current_user_id,)
    ).fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Uniqueness checks for username/email
    if "username" in updates and updates["username"] is not None:
        existing = db.execute(
            "SELECT id FROM users WHERE username = ? AND id != ?",
            (updates["username"], g.current_user_id)
        ).fetchone()
        if existing:
            return jsonify({"error": "Username already in use"}), 409

    if "email" in updates and updates["email"] is not None:
        existing = db.execute(
            "SELECT id FROM users WHERE email = ? AND id != ?",
            (updates["email"], g.current_user_id)
        ).fetchone()
        if existing:
            return jsonify({"error": "Email already in use"}), 409

    set_clause = ", ".join([f"{field} = ?" for field in updates.keys()])
    values = list(updates.values()) + [g.current_user_id]

    db.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
    db.commit()

    updated_user = db.execute(
        """
        SELECT id, username, email, first_name, last_name, bio
        FROM users
        WHERE id = ?
        """,
        (g.current_user_id,)
    ).fetchone()

    return jsonify({
        "message": "Profile updated successfully",
        "user": dict(updated_user)
    }), 200


if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)