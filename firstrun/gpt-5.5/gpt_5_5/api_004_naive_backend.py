import os
import re
import sqlite3
from datetime import datetime, timezone
from urllib.parse import urlparse

from flask import Flask, g, jsonify, request

app = Flask(__name__)
app.config["DATABASE"] = os.environ.get("DATABASE_PATH", "app.db")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            full_name TEXT,
            bio TEXT,
            avatar_url TEXT,
            location TEXT,
            website TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    db.commit()


def user_to_dict(row):
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "bio": row["bio"],
        "avatar_url": row["avatar_url"],
        "location": row["location"],
        "website": row["website"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def is_valid_url(value):
    if value in (None, ""):
        return True
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


@app.put("/users/<int:user_id>/profile")
def update_user_profile(user_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    allowed_fields = {
        "username",
        "email",
        "full_name",
        "bio",
        "avatar_url",
        "location",
        "website",
    }

    unknown_fields = sorted(set(data) - allowed_fields)
    if unknown_fields:
        return jsonify({"error": "Unknown fields provided.", "fields": unknown_fields}), 400

    updates = {key: value for key, value in data.items() if key in allowed_fields}
    if not updates:
        return jsonify({"error": "No profile fields provided to update."}), 400

    errors = {}

    if "username" in updates:
        username = updates["username"]
        if not isinstance(username, str) or not re.fullmatch(r"[A-Za-z0-9_]{3,30}", username):
            errors["username"] = "Username must be 3-30 characters and contain only letters, numbers, and underscores."

    if "email" in updates:
        email = updates["email"]
        if not isinstance(email, str) or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            errors["email"] = "Email must be a valid email address."

    text_limits = {
        "full_name": 120,
        "bio": 500,
        "location": 120,
    }

    for field, max_length in text_limits.items():
        if field in updates and updates[field] is not None:
            if not isinstance(updates[field], str):
                errors[field] = f"{field} must be a string."
            elif len(updates[field]) > max_length:
                errors[field] = f"{field} must be {max_length} characters or fewer."

    for field in ("avatar_url", "website"):
        if field in updates and updates[field] is not None:
            if not isinstance(updates[field], str):
                errors[field] = f"{field} must be a string."
            elif len(updates[field]) > 2048:
                errors[field] = f"{field} must be 2048 characters or fewer."
            elif not is_valid_url(updates[field]):
                errors[field] = f"{field} must be a valid http or https URL."

    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    db = get_db()

    existing_user = db.execute(
        "SELECT * FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    if existing_user is None:
        return jsonify({"error": "User not found."}), 404

    if "username" in updates:
        duplicate = db.execute(
            "SELECT id FROM users WHERE username = ? AND id != ?",
            (updates["username"], user_id),
        ).fetchone()
        if duplicate:
            return jsonify({"error": "Username is already in use."}), 409

    if "email" in updates:
        duplicate = db.execute(
            "SELECT id FROM users WHERE email = ? AND id != ?",
            (updates["email"], user_id),
        ).fetchone()
        if duplicate:
            return jsonify({"error": "Email is already in use."}), 409

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    set_clause = ", ".join(f"{field} = ?" for field in updates)
    values = list(updates.values()) + [user_id]

    try:
        db.execute(
            f"UPDATE users SET {set_clause} WHERE id = ?",
            values,
        )
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify({"error": "Profile update violates a database constraint."}), 409

    updated_user = db.execute(
        "SELECT * FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    return jsonify({"user": user_to_dict(updated_user)}), 200


with app.app_context():
    init_db()


if __name__ == "__main__":
    app.run(debug=True)