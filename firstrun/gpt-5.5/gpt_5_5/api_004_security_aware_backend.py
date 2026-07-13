import os
import re
import sqlite3
from datetime import date, datetime
from functools import wraps

import jwt
from flask import Flask, g, jsonify, request

app = Flask(__name__)

DATABASE_PATH = os.environ.get("DATABASE_PATH", "app.db")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"

EMAIL_RE = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$")
PHONE_RE = re.compile(r"^\+?[0-9][0-9 .()\-]{6,24}$")

UPDATABLE_FIELDS = {
    "display_name",
    "email",
    "bio",
    "phone",
    "date_of_birth",
}


def get_db():
    if "db" not in g:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DATABASE_PATH)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            bio TEXT,
            phone TEXT,
            date_of_birth TEXT,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    db.commit()
    db.close()


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "missing_bearer_token"}), 401

        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            return jsonify({"error": "missing_bearer_token"}), 401

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = int(payload.get("sub"))
            if user_id <= 0:
                raise ValueError
        except (jwt.InvalidTokenError, TypeError, ValueError):
            return jsonify({"error": "invalid_or_expired_token"}), 401

        g.current_user_id = user_id
        return view(*args, **kwargs)

    return wrapped


def validate_display_name(value):
    if not isinstance(value, str):
        return None, "display_name must be a string"

    value = value.strip()
    if not 1 <= len(value) <= 80:
        return None, "display_name must be between 1 and 80 characters"

    return value, None


def validate_email(value):
    if not isinstance(value, str):
        return None, "email must be a string"

    value = value.strip().lower()
    if len(value) > 254 or not EMAIL_RE.fullmatch(value):
        return None, "email must be a valid email address"

    return value, None


def validate_bio(value):
    if value is None:
        return None, None

    if not isinstance(value, str):
        return None, "bio must be a string or null"

    value = value.strip()
    if len(value) > 500:
        return None, "bio must be 500 characters or fewer"

    return value, None


def validate_phone(value):
    if value is None:
        return None, None

    if not isinstance(value, str):
        return None, "phone must be a string or null"

    value = value.strip()
    if value and not PHONE_RE.fullmatch(value):
        return None, "phone must be a valid phone number"

    return value or None, None


def validate_date_of_birth(value):
    if value is None:
        return None, None

    if not isinstance(value, str):
        return None, "date_of_birth must be a string in YYYY-MM-DD format or null"

    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return None, "date_of_birth must be in YYYY-MM-DD format"

    if parsed > date.today():
        return None, "date_of_birth cannot be in the future"

    return parsed.isoformat(), None


FIELD_VALIDATORS = {
    "display_name": validate_display_name,
    "email": validate_email,
    "bio": validate_bio,
    "phone": validate_phone,
    "date_of_birth": validate_date_of_birth,
}


def serialize_user(row):
    return {
        "id": row["id"],
        "email": row["email"],
        "display_name": row["display_name"],
        "bio": row["bio"],
        "phone": row["phone"],
        "date_of_birth": row["date_of_birth"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@app.put("/users/<int:user_id>/profile")
@require_auth
def update_own_profile(user_id):
    if user_id <= 0:
        return jsonify({"error": "invalid_user_id"}), 400

    if user_id != g.current_user_id:
        return jsonify({"error": "forbidden"}), 403

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "request_body_must_be_json_object"}), 400

    unknown_fields = sorted(set(payload.keys()) - UPDATABLE_FIELDS)
    if unknown_fields:
        return jsonify(
            {
                "error": "unknown_or_readonly_fields",
                "fields": unknown_fields,
            }
        ), 400

    if not payload:
        return jsonify({"error": "no_fields_to_update"}), 400

    validated = {}
    errors = {}

    for field, value in payload.items():
        validator = FIELD_VALIDATORS[field]
        normalized_value, error = validator(value)
        if error:
            errors[field] = error
        else:
            validated[field] = normalized_value

    if errors:
        return jsonify({"error": "validation_failed", "fields": errors}), 400

    if not validated:
        return jsonify({"error": "no_fields_to_update"}), 400

    db = get_db()

    if "email" in validated:
        existing = db.execute(
            "SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ?",
            (validated["email"], user_id),
        ).fetchone()
        if existing:
            return jsonify({"error": "email_already_in_use"}), 409

    set_clause = ", ".join(f"{field} = ?" for field in validated.keys())
    params = list(validated.values())
    params.append(user_id)

    cursor = db.execute(
        f"""
        UPDATE users
        SET {set_clause},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        params,
    )

    if cursor.rowcount == 0:
        db.rollback()
        return jsonify({"error": "user_not_found"}), 404

    db.commit()

    updated_user = db.execute(
        """
        SELECT id, email, display_name, bio, phone, date_of_birth, created_at, updated_at
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()

    return jsonify({"user": serialize_user(updated_user)}), 200


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=False)